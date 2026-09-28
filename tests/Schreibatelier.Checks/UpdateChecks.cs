using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Schreibatelier.App;

static class UpdateChecks
{
    public static async Task Run(string workspace, bool live)
    {
        var count = 0;
        void Check(bool ok, string message) { if (!ok) throw new Exception(message); Console.WriteLine("PASS " + message); count++; }
        async Task Reject(Func<Task> action, string label) { try { await action(); } catch (Exception ex) when (ex is IOException or InvalidDataException) { Check(true, label); return; } throw new Exception("Not rejected: " + label); }
        Check(GitHubUpdates.CompareVersions("0.1.0-alpha.10", "v0.1.0-alpha.2") > 0 && GitHubUpdates.CompareVersions("0.1.0", "0.1.0-rc.3") > 0 && GitHubUpdates.CompareVersions("1.0.0+build", "1.0.0") == 0, "SemVer orders previews numerically and ignores build metadata");
        Check(GitHubUpdates.CompareVersions("0.1.0-alpha.6", "0.1.0-alpha.5+testing.relationships") > 0, "Alpha 6 updates both Alpha 5 and the relationship testing build");
        foreach (var invalid in new[] { "1.2", "1.2.3-alpha.01", "01.2.3", "1.2.3/evil" })
        {
            try { GitHubUpdates.CompareVersions(invalid, "1.2.3"); throw new Exception("Invalid version accepted"); } catch (InvalidDataException) { }
        }
        Check(true, "Malformed versions cannot become update filenames");
        var payload = Encoding.UTF8.GetBytes("Synthetic update bytes, never executable.");
        var hash = Convert.ToHexString(SHA256.HashData(payload)).ToLowerInvariant();
        object Release(string version, bool preview = true, bool draft = false, bool portable = false, string? digest = null, string? url = null) {
            var name = $"Schreibatelier-{version}-{(portable ? "Portable-win-x64.zip" : "Setup-win-x64.exe")}";
            return new { tag_name = "v" + version, prerelease = preview, draft, body = "<img src=x onerror=alert(1)>", assets = new[] { new { name, state = "uploaded", size = payload.Length, digest = digest ?? "sha256:" + hash, browser_download_url = url ?? $"{GitHubUpdates.ReleasesUrl}/download/v{version}/{name}" } } };
        }
        var metadata = JsonSerializer.Serialize(new[] { Release("0.1.0-alpha.3"), Release("0.1.0-alpha.10"), Release("9.0.0", false, true), Release("0.1.0-alpha.12", url: "https://example.invalid/a.exe"), Release("0.1.0-alpha.11", digest: ""), Release("0.1.0-alpha.9", portable: true) });
        using var json = JsonDocument.Parse(metadata);
        Check(GitHubUpdates.SelectRelease(json.RootElement, "0.1.0-alpha.2", false)?.Version == "0.1.0-alpha.10", "Highest valid installer chosen; drafts, external URLs and missing hashes excluded");
        Check(GitHubUpdates.SelectRelease(json.RootElement, "0.1.0-alpha.2", true)?.Version == "0.1.0-alpha.9", "Portable builds select ZIP only");
        Check(GitHubUpdates.SelectRelease(json.RootElement, "0.1.0", false) is null, "Stable installs exclude prereleases and downgrades");
        var root = Path.Combine(workspace, ".work", "update-checks", Guid.NewGuid().ToString("N")); Directory.CreateDirectory(root);
        var handler = new FakeHttp(metadata, payload);
        using var updates = new GitHubUpdates(new HttpClient(handler), root, "0.1.0-alpha.2", false);
        Check((await updates.Check())?.Version == "0.1.0-alpha.10", "GitHub metadata request identifies release");
        var percent = -1; var path = await updates.Download(p => percent = p);
        using (var file = updates.OpenVerifiedDownload()) Check(file.Name == path && percent == 100 && File.ReadAllBytes(path).SequenceEqual(payload), "Download is complete and verified before exposure");
        File.WriteAllText(path, "tampered"); await Reject(() => { using var file = updates.OpenVerifiedDownload(); return Task.CompletedTask; }, "Changed file cannot be launched");
        handler.Payload = Encoding.UTF8.GetBytes(new string('x', payload.Length));
        await Reject(async () => await updates.Download(_ => { }), "Checksum mismatch rejects corrupt download");
        Check(!Directory.EnumerateFiles(root, "*.partial", SearchOption.AllDirectories).Any(), "Failed download leaves no partial executable");
        handler.Status = HttpStatusCode.Forbidden;
        await Reject(async () => await updates.Check(), "Rate limit reports failure instead of claiming current version");
        try { await updates.Download(_ => { }); throw new Exception("Stale release remained available"); } catch (InvalidOperationException) { Check(true, "Failed check invalidates stale download selection"); }
        handler.Status = HttpStatusCode.OK; handler.Payload = payload; await updates.Check(); handler.Wait = true;
        var pending = updates.Download(_ => { }); updates.Cancel();
        await Reject(async () => await pending, "Cancellation stops pending download");
        handler.Wait = false;
        await updates.Download(_ => { }); Check(true, "A cancelled download can be retried");
        await CacheChecks(Path.Combine(root, "cache"), metadata, payload, Check);
        if (live)
        {
            using var remote = new GitHubUpdates(new HttpClient(), root, "0.1.0-alpha.1", false);
            Check(await remote.Check() is not null, "Public GitHub feed is accessible without login and offers a newer installer");
            var publicFile = await remote.Download(_ => { });
            using var verified = remote.OpenVerifiedDownload();
            Check(verified.Name == publicFile, "Public installer downloads anonymously and passes the SHA-256 check");
        }
        Console.WriteLine($"{count} update checks passed.");
    }

    private static async Task CacheChecks(string root, string metadata, byte[] payload, Action<bool, string> check)
    {
        var firstHttp = new FakeHttp(metadata, payload);
        using var first = new GitHubUpdates(new HttpClient(firstHttp), root, "0.1.0-alpha.2", false);
        using var second = new GitHubUpdates(new HttpClient(new FakeHttp(metadata, payload)), root, "0.1.0-alpha.2", false);
        await first.Check(); await second.Check();
        var held = await first.Download(_ => { });
        var downloads = new List<string>();
        for (var i = 0; i < 4; i++) { downloads.Add(await second.Download(_ => { })); await Task.Delay(20); }
        await second.Check();
        check(File.Exists(held), "Other updater instances preserve a selected package");
        check(!File.Exists(downloads[0]) && !File.Exists(downloads[1]) && downloads.Skip(2).All(File.Exists), "Cache retains only the two newest inactive complete packages");
        await first.Check();
        check(!File.Exists(held), "Released old selection becomes eligible for cache cleanup");

        var handedOff = await first.Download(_ => { });
        first.LaunchDownload(_ => { });
        await first.Check();
        var failedLaunch = await second.Download(_ => { });
        try { second.LaunchDownload(_ => throw new IOException("Synthetic launch failure")); throw new Exception("Launch failure ignored"); }
        catch (IOException) { }
        var locked = await first.Download(_ => { }); await first.Check();
        using (new FileStream(locked, FileMode.Open, FileAccess.Read, FileShare.Read))
        {
            for (var i = 0; i < 4; i++) { await second.Download(_ => { }); await Task.Delay(20); }
            await second.Check();
            check(File.Exists(locked), "A package locked by another process does not break cleanup");
        }
        await second.Check();
        check(!File.Exists(locked) && !File.Exists(failedLaunch), "Unlocked packages and failed handoffs are cleaned later");
        check(File.Exists(handedOff), "Handed-off package survives cache pressure after owner releases it");

        var legacy = Path.Combine(root, "Updates", Guid.NewGuid().ToString("N")); Directory.CreateDirectory(legacy);
        var legacyFile = Path.Combine(legacy, "legacy.zip"); File.WriteAllText(legacyFile, "unmarked existing download");
        firstHttp.Wait = true;
        var pending = first.Download(_ => { });
        await second.Check(); first.Cancel();
        try { await pending; throw new Exception("Pending download unexpectedly succeeded"); } catch (IOException) { }
        check(File.Exists(legacyFile), "Unmarked legacy downloads are preserved");
        check(!Directory.EnumerateFiles(root, "*.partial", SearchOption.AllDirectories).Any(), "Cancelled concurrent download removes its incomplete bytes");
    }

    private sealed class FakeHttp(string json, byte[] payload) : HttpMessageHandler
    {
        public byte[] Payload = payload;
        public HttpStatusCode Status = HttpStatusCode.OK;
        public bool Wait;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        {
            if (Wait) await Task.Delay(Timeout.Infinite, token);
            return new(Status) { Content = request.RequestUri!.Host == "api.github.com" ? new StringContent(json) : new ByteArrayContent(Payload) };
        }
    }
}
