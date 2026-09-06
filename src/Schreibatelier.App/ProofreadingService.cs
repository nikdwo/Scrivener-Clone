using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Schreibatelier.Core;

namespace Schreibatelier.App;

public sealed record ProofBlock(int Id, string Text);
public sealed record ProofIssue(int Block, int Offset, int Length, string Original, string[] Replacements, string Message, string Category, string Rule);

public sealed class ProofreadingService(string dataDirectory, string? toolsDirectory) : IDisposable
{
    private readonly HttpClient http = new(new HttpClientHandler { AllowAutoRedirect = false, UseProxy = false }) { Timeout = TimeSpan.FromSeconds(90), MaxResponseContentBufferSize = 8_000_000 };
    private readonly HttpClient online = new(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(90), MaxResponseContentBufferSize = 8_000_000 };
    private readonly SemaphoreSlim gate = new(1, 1);
    private Process? local;
    private Uri? localUri;
    private CancellationTokenSource? checking;
    private readonly CodexProofreader codex = new(Path.Combine(dataDirectory, "ProofreadingCodex"));
    private string SecretFile => Path.Combine(dataDirectory, "languagetool.dat");
    private static string Text(JsonNode? node) => node?.GetValue<string>() ?? "";
    private static string? Find(string? folder, string file) => folder is not null && Directory.Exists(folder) ? Directory.EnumerateFiles(folder, file, SearchOption.AllDirectories).FirstOrDefault() : null;

    public object Status() => new { localAvailable = Find(toolsDirectory, "languagetool-server.jar") is not null && Find(toolsDirectory, "java.exe") is not null, premiumConnected = File.Exists(SecretFile), codexAvailable = CodexProofreader.FindExecutable() is not null };
    public Task<object> CodexStatus() => codex.Status();
    public Task<object> CodexLogin() => codex.Login();
    public Task CodexLogout() => codex.Logout();
    public void DisconnectPremium() { if (File.Exists(SecretFile)) File.Delete(SecretFile); }
    public void Cancel() { checking?.Cancel(); codex.Cancel(); }

    public async Task ConnectPremium(string username, string key)
    {
        if (string.IsNullOrWhiteSpace(username) || username.Length > 320 || string.IsNullOrWhiteSpace(key) || key.Length > 4096) throw new InvalidDataException("Bitte E-Mail und LanguageTool-Zugriffsschlüssel eingeben.");
        if (!await gate.WaitAsync(0)) throw new InvalidOperationException("Bitte den laufenden Prüfvorgang zuerst abschließen.");
        try
        {
            var credentials = new JsonObject { ["username"] = username.Trim(), ["apiKey"] = key.Trim() };
            var response = await LanguageTool(new Uri("https://api.languagetoolplus.com/v2/check"), "Dies ist ein kurzer Verbindungstest.", "de-DE", false, credentials, CancellationToken.None);
            if (response["software"]?["premium"]?.GetValue<bool>() != true) throw new InvalidDataException("Dieser Zugang bestätigt keine Premium-Prüfung. Bitte Berechtigung und Zugriffsschlüssel prüfen.");
            var encrypted = ProtectedData.Protect(Encoding.UTF8.GetBytes(credentials.ToJsonString()), null, DataProtectionScope.CurrentUser);
            var staged = SecretFile + ".tmp";
            await File.WriteAllBytesAsync(staged, encrypted); File.Move(staged, SecretFile, true);
        }
        finally { gate.Release(); }
    }

    public async Task<object> Check(JsonObject args)
    {
        var engine = Text(args["engine"]); var language = Text(args["language"]);
        if (engine is not ("local" or "premium" or "codex") || language is not ("de-DE" or "de-AT" or "de-CH")) throw new InvalidDataException("Unbekanntes Prüfverfahren oder nicht unterstützte Sprache.");
        var blocks = args["blocks"]?.Deserialize<ProofBlock[]>(Model.Json) ?? [];
        if (blocks.Length is 0 or > 2000 || blocks.Select(b => b.Id).Distinct().Count() != blocks.Length || blocks.Any(b => b.Text is null || b.Text.Length > 8000 || b.Id < 0) || blocks.Sum(b => b.Text.Length) > 1_000_000) throw new InvalidDataException("Bitte einen Textabschnitt mit höchstens einer Million Zeichen prüfen.");
        if (!await gate.WaitAsync(0)) throw new InvalidOperationException("Eine Prüfung läuft bereits. Bitte warten oder abbrechen.");
        using var cancellation = new CancellationTokenSource(TimeSpan.FromMinutes(10)); checking = cancellation;
        try
        {
            var style = args["style"]?.GetValue<bool>() == true;
            var issues = new List<ProofIssue>();
            JsonObject? credentials = null;
            if (engine == "premium")
            {
                if (!File.Exists(SecretFile)) throw new InvalidOperationException("Bitte LanguageTool Premium zuerst verbinden.");
                credentials = JsonNode.Parse(ProtectedData.Unprotect(await File.ReadAllBytesAsync(SecretFile), null, DataProtectionScope.CurrentUser))!.AsObject();
            }
            var endpoint = engine == "local" ? await StartLocal(cancellation.Token) : new Uri("https://api.languagetoolplus.com/v2/check");
            foreach (var batch in Batches(blocks, engine == "codex" ? 12000 : 45000))
            {
                cancellation.Token.ThrowIfCancellationRequested();
                if (engine == "codex") { issues.AddRange(await codex.Check(batch, language, Text(args["model"]), style, cancellation.Token)); continue; }
                // A one-character space keeps UTF-16 offsets and sentence boundaries; ParseMatches still rejects corrections across the original atom.
                var joined = string.Join("\n\n", batch.Select(b => b.Text.Replace('\ufffc', ' ')));
                var result = await LanguageTool(endpoint, joined, language, style, credentials, cancellation.Token);
                if (engine == "premium" && result["software"]?["premium"]?.GetValue<bool>() != true) throw new InvalidDataException("Der Anbieter bestätigt keine Premium-Prüfung mehr. Bitte Konto prüfen.");
                if (result["warnings"]?["incompleteResults"]?.GetValue<bool>() == true) throw new InvalidDataException("LanguageTool hat die Prüfung nicht vollständig abgeschlossen. Bitte einen kürzeren Text prüfen.");
                issues.AddRange(ParseMatches(batch, result));
            }
            return new { issues, engine };
        }
        catch (OperationCanceledException) { throw new InvalidOperationException("Prüfung abgebrochen oder Zeitlimit erreicht."); }
        finally { checking = null; gate.Release(); }
    }

    internal static IEnumerable<ProofBlock[]> Batches(ProofBlock[] blocks, int limit)
    {
        var batch = new List<ProofBlock>(); var length = 0;
        foreach (var block in blocks) { if (length + block.Text.Length + 2 > limit && batch.Count > 0) { yield return batch.ToArray(); batch.Clear(); length = 0; } batch.Add(block); length += block.Text.Length + 2; }
        if (batch.Count > 0) yield return batch.ToArray();
    }
    internal static IEnumerable<ProofIssue> ParseMatches(ProofBlock[] blocks, JsonObject result)
    {
        if (result["matches"] is not JsonArray matches) throw new InvalidDataException("LanguageTool lieferte keine gültigen Prüfergebnisse.");
        foreach (var match in matches.Take(5000))
        {
            if (match is null) continue;
            var offset = match["offset"]?.GetValue<int>() ?? -1; var length = match["length"]?.GetValue<int>() ?? 0;
            var baseOffset = 0;
            foreach (var block in blocks)
            {
                var start = offset - baseOffset;
                if (start >= 0 && length > 0 && start <= block.Text.Length - length)
                {
                    var original = block.Text.Substring(start, length);
                    var type = Text(match["rule"]?["issueType"]);
                    var category = type == "misspelling" ? "spelling" : Text(match["rule"]?["category"]?["id"]) == "PUNCTUATION" ? "punctuation" : type is "style" or "redundancy" or "locale-violation" ? "style" : "grammar";
                    if (!original.Contains('\ufffc')) yield return new(block.Id, start, length, original, match["replacements"]?.AsArray().Take(8).Select(r => Text(r?["value"])).Where(r => r.Length <= 8000).ToArray() ?? [], Text(match["message"]), category, Text(match["rule"]?["id"]));
                    break;
                }
                baseOffset += block.Text.Length + 2;
            }
        }
    }
    private async Task<JsonObject> LanguageTool(Uri endpoint, string text, string language, bool style, JsonObject? credentials, CancellationToken token)
    {
        var form = new Dictionary<string, string> { ["text"] = text, ["language"] = language, ["level"] = style ? "picky" : "default" };
        if (credentials is not null) { form["username"] = Text(credentials["username"]); form["apiKey"] = Text(credentials["apiKey"]); }
        using var body = new FormUrlEncodedContent(form);
        using var response = await (endpoint.IsLoopback ? http : online).PostAsync(endpoint, body, token);
        if (!response.IsSuccessStatusCode) throw new HttpRequestException(response.StatusCode switch { HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => "LanguageTool-Zugang abgelehnt. Bitte Konto und Zugriffsschlüssel prüfen.", HttpStatusCode.TooManyRequests => "LanguageTool-Kontingent erreicht. Bitte später erneut prüfen.", _ => $"LanguageTool ist nicht verfügbar (HTTP {(int)response.StatusCode})." });
        return JsonNode.Parse(await response.Content.ReadAsStringAsync(token))?.AsObject() ?? throw new InvalidDataException("Ungültige LanguageTool-Antwort.");
    }
    private async Task<Uri> StartLocal(CancellationToken token)
    {
        if (local is { HasExited: false } && localUri is not null) return localUri;
        var jar = Find(toolsDirectory, "languagetool-server.jar"); var java = Find(toolsDirectory, "java.exe");
        if (jar is null || java is null) throw new FileNotFoundException("Die lokale Sprachprüfung fehlt. Bitte scripts/install-proofreading.ps1 ausführen.");
        using var listener = new TcpListener(IPAddress.Loopback, 0); listener.Start(); var port = ((IPEndPoint)listener.LocalEndpoint).Port; listener.Stop();
        var config = Path.Combine(dataDirectory, "languagetool.properties");
        await File.WriteAllTextAsync(config, "maxTextLength=60000\nmaxCheckThreads=1\ncacheSize=0\n", token);
        var start = new ProcessStartInfo(java) { WorkingDirectory = Path.GetDirectoryName(jar)!, UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
        foreach (var argument in new[] { "-Xmx768m", "-Djava.awt.headless=true", "-cp", jar, "org.languagetool.server.HTTPServer", "--port", port.ToString(), "--config", config }) start.ArgumentList.Add(argument);
        local?.Dispose(); local = Process.Start(start) ?? throw new IOException("Lokale Prüfung konnte nicht starten.");
        local.OutputDataReceived += (_, _) => { }; local.ErrorDataReceived += (_, _) => { }; local.BeginOutputReadLine(); local.BeginErrorReadLine();
        localUri = new Uri($"http://127.0.0.1:{port}/v2/check");
        try
        {
            for (var attempt = 0; attempt < 120; attempt++)
            {
                token.ThrowIfCancellationRequested(); if (local.HasExited) throw new IOException("Die lokale Sprachprüfung wurde beim Start beendet.");
                try { using var response = await http.GetAsync($"http://127.0.0.1:{port}/v2/languages", token); if (response.IsSuccessStatusCode) return localUri; } catch (HttpRequestException) { }
                await Task.Delay(250, token);
            }
            throw new TimeoutException("Die lokale Sprachprüfung konnte nicht rechtzeitig gestartet werden.");
        }
        catch { if (!local.HasExited) local.Kill(true); localUri = null; throw; }
    }
    public void Dispose() { Cancel(); if (local is { HasExited: false }) local.Kill(true); local?.Dispose(); codex.Dispose(); http.Dispose(); online.Dispose(); }
}
