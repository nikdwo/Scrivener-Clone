using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;
using Schreibatelier.App;
using Schreibatelier.Core;

var root = Path.GetFullPath(args.FirstOrDefault() ?? Environment.CurrentDirectory);
var data = Path.Combine(root, ".work", "proof-checks"); Directory.CreateDirectory(data);
void Check(bool condition, string message) { if (!condition) throw new Exception(message); Console.WriteLine("OK " + message); }
if (args.Contains("--codex-live"))
{
    // Explicit opt-in: uses Schreibatelier's existing sign-in and only this synthetic sentence.
    using var codex = new CodexProofreader(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Schreibatelier", "ProofreadingCodex"));
    var status = JsonSerializer.SerializeToNode(await codex.Status(), Model.Json)!;
    Check(status["connected"]?.GetValue<bool>() == true, "Schreibatelier ChatGPT account is connected");
    var model = status["models"]!.AsArray().FirstOrDefault(m => string.Equals(m?["name"]?.GetValue<string>(), "GPT-5.6-Sol", StringComparison.OrdinalIgnoreCase))?["id"]?.GetValue<string>() ?? throw new Exception("Das im Fehlerbericht ausgewählte GPT-5.6-Sol ist nicht verfügbar.");
    using var timeout = new CancellationTokenSource(TimeSpan.FromMinutes(5));
    var corrections = (await codex.Check([new(0, "Das ist ein Feler. Ich habe ein Apfel gegessen.")], "de-DE", model, false, timeout.Token)).ToArray();
    Check(corrections.Any(i => i.Original.Contains("Feler") && i.Replacements.Any(r => r.Contains("Fehler"))), "Live ChatGPT proofreading returns a spelling correction through the restricted profile");
    Check(corrections.Any(i => i.Category == "grammar"), "Live ChatGPT proofreading returns a grammar correction");
    await File.WriteAllTextAsync(Path.Combine(data, "codex-live-result.json"), JsonSerializer.Serialize(new { model, corrections }, Model.Json));
    return;
}
var blocks = new[] { new ProofBlock(0, "😀 Das ist ein Feler."), new ProofBlock(1, "Ich bin müde.") };
var matches = JsonNode.Parse("""{"matches":[{"offset":15,"length":5,"message":"Schreibweise","replacements":[{"value":"Fehler"}],"rule":{"id":"TEST","issueType":"misspelling"}},{"offset":24,"length":3,"replacements":[],"rule":{}}]}""")!.AsObject();
var parsed = ProofreadingService.ParseMatches(blocks, matches).ToArray();
Check(parsed.Length == 2 && parsed[0].Original == "Feler" && parsed[1].Original == "ch " && parsed[1].Block == 1, "LanguageTool offsets use UTF-16 and retain paragraph mapping");
var ai = CodexProofreader.ParseAnswer(blocks, """{"issues":[{"block":0,"original":"Feler","replacement":"Fehler","message":"Schreibweise","category":"spelling"},{"block":0,"original":"Erfunden","replacement":"Nein","message":"Ungültig","category":"grammar"}]}""");
Check(ai.Length == 1 && ai[0].Offset == 15, "KI replacement must match the original text");
Check(CodexProofreader.ParseAnswer([new(0, "Wort Wort")], """{"issues":[{"block":0,"original":"Wort","replacement":"Ort","message":"Mehrdeutig","category":"spelling"}]}""").Length == 0, "Ambiguous KI corrections are rejected");
using var service = new ProofreadingService(data, Path.Combine(root, ".tools"));
var request = new JsonObject { ["engine"] = "local", ["language"] = "de-DE", ["blocks"] = JsonSerializer.SerializeToNode(new[] { new ProofBlock(0, "Das ist ein Feler. Ich habe ein Apfel gegessen.") }, Model.Json) };
var result = JsonSerializer.SerializeToNode(await service.Check(request), Model.Json)!;
var issues = result["issues"]!.AsArray();
Check(issues.Any(i => i?["original"]?.GetValue<string>() == "Feler" && i["category"]?.GetValue<string>() == "spelling"), "Real local German spelling check finds Feler");
Check(issues.Any(i => i?["category"]?.GetValue<string>() == "grammar"), "Real local German grammar check finds agreement error");
foreach (var language in new[] { "de-AT", "de-CH" }) { request["language"] = language; _ = await service.Check(request); Check(true, "Real local check accepts " + language); }
request["language"] = "de-DE"; request["blocks"] = JsonSerializer.SerializeToNode(new[] { new ProofBlock(0, "Das ist gut.\ufffc Ein Feler.") }, Model.Json);
var footnoteResult = JsonSerializer.SerializeToNode(await service.Check(request), Model.Json)!;
Check(!footnoteResult["issues"]!.AsArray().Any(i => i?["original"]?.GetValue<string>() == "Ein"), "Footnote marker preserves the following sentence boundary");
await File.WriteAllTextAsync(Path.Combine(data, "local-result.json"), result.ToJsonString());
var fixture = Path.Combine(data, "native-" + Model.Id() + ".schreibprojekt");
using (var project = ProjectStore.Create(fixture, "Sprachprüfung – Integration")) { }
await File.WriteAllTextAsync(Path.Combine(data, "native-project.txt"), fixture);
if (args.Contains("--codex")) { var status = await service.CodexStatus(); Console.WriteLine(JsonSerializer.Serialize(status, Model.Json)); Check(true, "Codex app-server handshake and isolated account status"); }
Console.WriteLine("Proofreading checks passed.");
