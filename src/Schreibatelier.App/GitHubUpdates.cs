using System.IO;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Schreibatelier.App;

public sealed record UpdateRelease(string Version, string Notes, string FileName, string DownloadUrl, string Sha256, long Size);

public sealed class GitHubUpdates(HttpClient http, string directory, string currentVersion, bool portable) : IDisposable
{
    public const string Repository = "nikdwo/Schreibatelier-Releases";
    public const string ReleasesUrl = "https://github.com/" + Repository + "/releases";
    private const string Api = "https://api.github.com/repos/" + Repository;
    private CancellationTokenSource? operation;
    private UpdateRelease? available;
    private string? downloaded;
    private FileStream? downloadLease;
    private string downloadState = "";
    public string CurrentVersion => currentVersion;
    public bool Portable => portable;

    // Compare SemVer identifiers numerically (alpha.10 follows alpha.2); metadata does not change precedence.
    public static int CompareVersions(string left, string right)
    {
        var a = ParseVersion(left); var b = ParseVersion(right);
        var order = a.Core.CompareTo(b.Core); if (order != 0) return order;
        if (a.Pre.Length == 0 || b.Pre.Length == 0) return (a.Pre.Length == 0 ? 1 : 0).CompareTo(b.Pre.Length == 0 ? 1 : 0);
        for (var i = 0; i < Math.Min(a.Pre.Length, b.Pre.Length); i++)
        {
            var x = a.Pre[i]; var y = b.Pre[i]; var xn = x.All(char.IsAsciiDigit); var yn = y.All(char.IsAsciiDigit);
            order = xn && yn ? (x.Length != y.Length ? x.Length.CompareTo(y.Length) : string.CompareOrdinal(x, y))
                : xn != yn ? (xn ? -1 : 1) : string.CompareOrdinal(x, y);
            if (order != 0) return order;
        }
        return a.Pre.Length.CompareTo(b.Pre.Length);
    }

    private static (Version Core, string[] Pre) ParseVersion(string value)
    {
        if (value.Length > 120) throw new InvalidDataException("Ungültige Versionsnummer.");
        var match = Regex.Match(value, @"^v?(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$", RegexOptions.CultureInvariant);
        if (!match.Success || !Version.TryParse($"{match.Groups[1]}.{match.Groups[2]}.{match.Groups[3]}", out var core)) throw new InvalidDataException("Ungültige Versionsnummer.");
        var pre = match.Groups[4].Success ? match.Groups[4].Value.Split('.') : [];
        if (pre.Any(p => p.Length > 1 && p[0] == '0' && p.All(char.IsAsciiDigit))) throw new InvalidDataException("Ungültige Vorabversion.");
        return (core, pre);
    }

    public static UpdateRelease? SelectRelease(JsonElement releases, string current, bool portable)
    {
        var previews = ParseVersion(current).Pre.Length > 0;
        UpdateRelease? latest = null;
        foreach (var release in releases.EnumerateArray())
        {
            if (release.GetProperty("draft").GetBoolean()) continue;
            var tag = release.GetProperty("tag_name").GetString() ?? "";
            try { if (CompareVersions(tag, current) <= 0 || (!previews && (release.GetProperty("prerelease").GetBoolean() || ParseVersion(tag).Pre.Length > 0))) continue; }
            catch (InvalidDataException) { continue; }
            var version = tag.StartsWith('v') ? tag[1..] : tag;
            var name = $"Schreibatelier-{version}-{(portable ? "Portable-win-x64.zip" : "Setup-win-x64.exe")}";
            foreach (var asset in release.GetProperty("assets").EnumerateArray())
            {
                if (asset.GetProperty("name").GetString() != name || asset.GetProperty("state").GetString() != "uploaded") continue;
                var url = asset.GetProperty("browser_download_url").GetString() ?? "";
                var digest = asset.TryGetProperty("digest", out var d) ? d.GetString() ?? "" : "";
                var size = asset.GetProperty("size").GetInt64();
                if (url != $"https://github.com/{Repository}/releases/download/{Uri.EscapeDataString(tag)}/{Uri.EscapeDataString(name)}"
                    || !Regex.IsMatch(digest, "^sha256:[a-fA-F0-9]{64}$") || size <= 0 || size > 2_000_000_000) continue;
                if (latest is null || CompareVersions(version, latest.Version) > 0)
                    latest = new(version, release.TryGetProperty("body", out var body) ? body.GetString() ?? "" : "", name, url, digest[7..], size);
            }
        }
        return latest;
    }

    private async Task<T> Run<T>(TimeSpan timeout, Func<CancellationToken, Task<T>> action)
    {
        if (operation is not null) throw new InvalidOperationException("Eine Update-Prüfung oder ein Download läuft bereits.");
        using var source = new CancellationTokenSource(timeout); operation = source;
        try { return await action(source.Token); }
        catch (OperationCanceledException) { throw new IOException("Update-Vorgang abgebrochen oder Zeitlimit erreicht. Du kannst ihn erneut starten."); }
        catch (HttpRequestException ex) { throw new IOException("GitHub ist gerade nicht erreichbar. Bitte Internetverbindung prüfen und später erneut versuchen.", ex); }
        finally { operation = null; }
    }

    public Task<UpdateRelease?> Check() => Run(TimeSpan.FromSeconds(30), async token =>
    {
        available = null; ReleaseDownload(); CleanupDownloads();
        UpdateRelease? latest = null;
        // Scan all pages rather than /latest, which excludes Alpha/Beta releases.
        for (var page = 1; page <= 100; page++)
        {
            using var request = Request($"{Api}/releases?per_page=100&page={page}");
            using var response = await http.SendAsync(request, token);
            if (response.StatusCode == HttpStatusCode.NotFound) throw new IOException("Die öffentliche Update-Quelle ist noch nicht verfügbar.");
            if (response.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.TooManyRequests) throw new IOException("GitHub begrenzt gerade die Update-Abfragen. Bitte später erneut versuchen.");
            response.EnsureSuccessStatusCode();
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(token));
            var candidate = SelectRelease(json.RootElement, currentVersion, portable);
            if (candidate is not null && (latest is null || CompareVersions(candidate.Version, latest.Version) > 0)) latest = candidate;
            if (json.RootElement.GetArrayLength() < 100) { available = latest; return available; }
        }
        throw new IOException("Die Release-Liste ist zu groß für eine vollständige Prüfung.");
    });

    public Task<string> Download(Action<int> progress) => Run(TimeSpan.FromMinutes(30), async token =>
    {
        var release = available ?? throw new InvalidOperationException("Bitte zuerst nach Updates suchen.");
        ReleaseDownload(); CleanupDownloads();
        var root = Path.GetFullPath(Path.Combine(directory, "Updates")); Directory.CreateDirectory(root);
        if ((File.GetAttributes(root) & FileAttributes.ReparsePoint) != 0) throw new IOException("Der Updateordner darf keine Verzeichnisverknüpfung sein.");
        var folder = Path.Combine(root, Guid.NewGuid().ToString("N"));
        var leasePath = folder + ".lease";
        downloadLease = new FileStream(leasePath, FileMode.CreateNew, FileAccess.ReadWrite, FileShare.None);
        var target = Path.Combine(folder, release.FileName); var partial = target + ".partial";
        try
        {
            SetDownloadState("downloading"); Directory.CreateDirectory(folder);
            using var request = Request(release.DownloadUrl);
            using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, token);
            response.EnsureSuccessStatusCode();
            if (response.Content.Headers.ContentLength is long length && length != release.Size) throw new InvalidDataException("Der Download hat eine unerwartete Größe.");
            await using (var input = await response.Content.ReadAsStreamAsync(token))
            await using (var output = new FileStream(partial, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, true))
            using (var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256))
            {
                var buffer = new byte[81920]; long total = 0; var previous = -1;
                while (true)
                {
                    var read = await input.ReadAsync(buffer, token); if (read == 0) break;
                    total += read; if (total > release.Size) throw new InvalidDataException("Der Download ist größer als angekündigt.");
                    hash.AppendData(buffer, 0, read); await output.WriteAsync(buffer.AsMemory(0, read), token);
                    var percent = (int)(total * 100 / release.Size); if (percent != previous) { progress(percent); previous = percent; }
                }
                if (total != release.Size || !Convert.ToHexString(hash.GetHashAndReset()).Equals(release.Sha256, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidDataException("Die SHA-256-Prüfung ist fehlgeschlagen. Das Update wird nicht geöffnet; bitte erneut herunterladen.");
            }
            File.Move(partial, target); SetDownloadState("complete"); downloaded = target; return target;
        }
        finally
        {
            if (downloaded is null)
            {
                // The directory belongs to this failed operation, never another selected download.
                try { DeleteDownloadFolder(folder); }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
                ReleaseDownload();
                try { if (!Directory.Exists(folder)) File.Delete(leasePath); }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
            }
        }
    });

    private void ReleaseDownload() { downloaded = null; downloadLease?.Dispose(); downloadLease = null; downloadState = ""; }
    private void SetDownloadState(string state)
    {
        var lease = downloadLease ?? throw new IOException("Der Updatevorgang wurde beendet.");
        var bytes = System.Text.Encoding.UTF8.GetBytes(state);
        lease.Position = 0; lease.Write(bytes); lease.SetLength(bytes.Length); lease.Flush(true); downloadState = state;
    }
    private static void DeleteDownloadFolder(string folder)
    {
        if (!Directory.Exists(folder)) return;
        if ((File.GetAttributes(folder) & FileAttributes.ReparsePoint) != 0) return;
        var files = Directory.GetFileSystemEntries(folder);
        if (files.Any(file => (File.GetAttributes(file) & (FileAttributes.Directory | FileAttributes.ReparsePoint)) != 0)) return;
        foreach (var file in files) File.Delete(file);
        Directory.Delete(folder);
    }
    private void CleanupDownloads()
    {
        var root = Path.GetFullPath(Path.Combine(directory, "Updates"));
        try
        {
            if (!Directory.Exists(root) || (File.GetAttributes(root) & FileAttributes.ReparsePoint) != 0) return;
            var candidates = Directory.GetDirectories(root).Where(folder => Guid.TryParseExact(Path.GetFileName(folder), "N", out _)
                && (File.GetAttributes(folder) & FileAttributes.ReparsePoint) == 0 && File.Exists(folder + ".lease"))
                .OrderByDescending(folder => File.GetLastWriteTimeUtc(folder + ".lease")).ToArray();
            var retained = 0;
            foreach (var folder in candidates)
            {
                var marker = folder + ".lease";
                try
                {
                    if ((File.GetAttributes(marker) & FileAttributes.ReparsePoint) != 0) continue;
                    using (var lease = new FileStream(marker, FileMode.Open, FileAccess.ReadWrite, FileShare.None))
                    {
                        if (lease.Length > 32) continue;
                        using var reader = new StreamReader(lease, leaveOpen: true);
                        if (reader.ReadToEnd() != "complete") continue;
                        if (retained++ < 2) continue;
                        DeleteDownloadFolder(folder);
                    }
                    if (!Directory.Exists(folder)) File.Delete(marker);
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { /* Active owner or external file lock: try next time. */ }
            }
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { /* Cache maintenance must not prevent update checks. */ }
    }

    public void LaunchDownload(Action<string> launch)
    {
        using var package = OpenVerifiedDownload();
        var previous = downloadState;
        SetDownloadState("handed-off");
        try { launch(package.Name); }
        catch
        {
            try { SetDownloadState(previous); }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { /* Keep it protected if restoring the marker fails. */ }
            throw;
        }
    }

    // Keep this read handle open until the installer starts, preventing changes after verification.
    public FileStream OpenVerifiedDownload()
    {
        if (operation is not null || downloaded is null || available is null) throw new InvalidOperationException("Bitte das Update zuerst vollständig herunterladen.");
        var file = new FileStream(downloaded, FileMode.Open, FileAccess.Read, FileShare.Read);
        try
        {
            if (file.Length != available.Size || !Convert.ToHexString(SHA256.HashData(file)).Equals(available.Sha256, StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException("Die heruntergeladene Datei wurde verändert. Bitte erneut herunterladen.");
            return file;
        }
        catch { file.Dispose(); throw; }
    }

    private static HttpRequestMessage Request(string url)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.UserAgent.ParseAdd("Schreibatelier-Updater/1.0");
        if (new Uri(url).Host == "api.github.com") { request.Headers.Accept.ParseAdd("application/vnd.github+json"); request.Headers.Add("X-GitHub-Api-Version", "2026-03-10"); }
        return request;
    }
    public void Cancel() => operation?.Cancel();
    public void Dispose() { Cancel(); ReleaseDownload(); http.Dispose(); }
}
