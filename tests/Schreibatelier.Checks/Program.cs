using Schreibatelier.Core;
using Schreibatelier.App;
using System.Diagnostics;
using System.Text.Json.Nodes;
using Microsoft.Data.Sqlite;

if (args.Length > 0 && args[0].StartsWith("--native-review-", StringComparison.Ordinal)) { await NativeReviewFixtures.Run(args); return; }
if (args.FirstOrDefault() == "--converter-review-child") { await CoreReviewChecks.RunChild(args); return; }
if (args.Contains("--sandbox") && args.Any(arg => arg.StartsWith("--extract-media=", StringComparison.Ordinal))) { CoreReviewChecks.ImportCleanupChild(args); return; }

if (args.FirstOrDefault() == "--crash-writer")
{
    using var childStore = new ProjectStore(args[1]);
    var doc = childStore.GetDocument(args[2]); doc.Body = Model.TextBody("Bestätigt gespeichert."); childStore.SaveDocuments([doc]);
    using var db = new SqliteConnection("Data Source=" + args[1]); db.Open(); using var tx = db.BeginTransaction();
    using var cmd = db.CreateCommand(); cmd.CommandText = "UPDATE documents SET body='unvollständig' WHERE id=$id"; cmd.Parameters.AddWithValue("$id", args[2]); cmd.ExecuteNonQuery();
    File.WriteAllText(args[1] + ".ready", "ready"); await Task.Delay(Timeout.Infinite); return;
}

var workspace = args.FirstOrDefault() ?? Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../"));
if (args.Contains("--updates")) { await UpdateChecks.Run(workspace, args.Contains("--live")); return; }
var root = Path.Combine(workspace, ".work", "checks", Model.Id()); Directory.CreateDirectory(root);
if (args.Contains("--converter-processes"))
{
    try { await CoreReviewChecks.RunConverterProcesses(root); }
    catch (Exception ex) { Console.Error.WriteLine(ex); Environment.ExitCode = 1; }
    return;
}
if (!args.Any(arg => arg.StartsWith("--", StringComparison.Ordinal)) || args.Contains("--core-review"))
{
    AssetChecks.Run(root); await CoreReviewChecks.Run(root, workspace);
    if (args.Contains("--core-review")) return;
}
RelationshipChecks.Run(root);
if(args.Contains("--relationships"))return;
if (args.Contains("--timeline")) { await TimelineChecks.Run(root); return; }
await TimelineChecks.Run(root);
if (args.Contains("--cards")) { await StoryCardChecks.Run(root); return; }
await StoryCardChecks.Run(root);
var passed = 0;
void Check(bool condition, string label) { if (!condition) throw new Exception("FAILED: " + label); passed++; Console.WriteLine("PASS " + label); }
void Throws<T>(Action action, string label) where T : Exception { try { action(); } catch (T) { Check(true, label); return; } throw new Exception("FAILED (no exception): " + label); }
var recent = new RecentProjects(root);
Check(recent.Read().Length == 0, "Opening history starts empty");
foreach (var name in new[] { "A", "B", "C", "D" }) recent.Remember(name, Path.Combine(root, name + ".schreibprojekt"));
Check(new RecentProjects(root).Read().Select(p => p.Title).SequenceEqual(new[] { "D", "C", "B" }), "Only the three most recently opened projects survive reload");
recent.Remember("B renamed", Path.Combine(root, "B.schreibprojekt").ToUpperInvariant());
Check(recent.Read().Select(p => p.Title).SequenceEqual(new[] { "B renamed", "D", "C" }), "Reopening promotes a project without case-sensitive duplicates");
Check(recent.Read().All(p => !File.Exists(p.FilePath)), "Unavailable projects stay listed without creating missing files");
File.WriteAllText(Path.Combine(root, "recent-projects.json"), "[null,{\"title\":\"Invalid\",\"filePath\":\"relative.schreibprojekt\"}]");
Check(recent.Read().Length == 0, "Malformed opening-history entries are ignored");
File.WriteAllText(Path.Combine(root, "recent-projects.json"), "not json");
Check(recent.Read().Length == 0, "Damaged opening history does not prevent startup");
if (args.Contains("--recent-projects")) { Console.WriteLine($"{passed} recent-project checks passed."); return; }
var path = Path.Combine(root, "test.schreibprojekt");
using (var store = ProjectStore.Create(path, "Prüfmanuskript", Path.Combine(root, "backups")))
{
    Check(store.GetProject().Documents.Count == 2, "New project contains two roots");
    Check(!store.GetProject().Settings.ContainsKey("styleAnalysis"), "Older projects need no style settings migration");
    var styleSettings = new JsonObject { ["styleAnalysis"] = new JsonObject { ["repetitions"] = true, ["sentences"] = false, ["wording"] = true, ["automatic"] = true } };
    store.SaveSettings("Prüfmanuskript", styleSettings);
    using (var reader = new ProjectStore(path))
    {
        Check(reader.GetProject().Settings["styleAnalysis"]!.ToJsonString() == styleSettings["styleAnalysis"]!.ToJsonString(), "Style preferences survive a separate SQLite connection");
        Throws<IOException>(() => reader.SaveSettings("Prüfmanuskript", styleSettings), "Read-only project cannot change style preferences");
    }
    foreach (var invalidStyle in new[] { "null", "true", "[]", "{\"automatic\":\"yes\"}", "{\"wording\":1}", "{\"unexpected\":true}" })
        Throws<InvalidDataException>(() => store.SaveSettings("Bad", new JsonObject { ["styleAnalysis"] = JsonNode.Parse(invalidStyle) }), "Invalid style settings rejected: " + invalidStyle);
    Check(store.GetProject().Title == "Prüfmanuskript" && store.GetProject().Settings.ToJsonString() == styleSettings.ToJsonString(), "Rejected settings preserve project title and earlier preferences");
    var styleCopy = Path.Combine(root, "style-settings.schreibprojekt"); store.SaveCopy(styleCopy);
    using (var reopenedStyle = new ProjectStore(styleCopy)) Check(reopenedStyle.GetProject().Settings.ToJsonString() == styleSettings.ToJsonString(), "Reopening a project copy preserves style preferences");
    var first = store.AddDocument("manuscript", "Kapitel Eins", body: Model.TextBody("Grüße, Welt. Ein neuer Anfang."));
    var second = store.AddDocument("manuscript", "Kapitel Zwei", body: Model.TextBody("Dieser Text bleibt erhalten."));
    Check(first.Words == 5, "Unicode word count");
    first.Title = "Erster Morgen"; first.Meta["synopsis"] = "Eine Idee.";
    var saved = store.SaveDocuments([first])[0];
    Check(saved.Revision == 1 && saved.Title == "Erster Morgen", "Durable update advances revision");
    Throws<RevisionConflictException>(() => store.SaveDocuments([first]), "Stale editor cannot overwrite new version");
    second.Title = "Must roll back";
    Throws<RevisionConflictException>(() => store.SaveDocuments([second, first]), "Mixed batch fails atomically");
    Check(store.GetDocument(second.Id).Title == "Kapitel Zwei", "Earlier change in failed transaction was rolled back");
    store.Move(second.Id, first.Id, 0);
    Throws<InvalidDataException>(() => store.Move(first.Id, second.Id, 0), "Hierarchy cycle rejected");
    store.Trash(first.Id, true);
    Check(store.GetDocument(second.Id).Deleted, "Trash includes descendants");
    Throws<InvalidDataException>(() => store.Trash(second.Id, false), "Child cannot be restored under deleted parent");
    store.Trash(first.Id, false); Check(!store.GetDocument(second.Id).Deleted, "Restore includes descendants");
    var snap = store.Snapshot(first.Id, "Original"); var edit = store.GetDocument(first.Id); edit.Body = Model.TextBody("Überarbeitet."); store.SaveDocuments([edit]); store.RestoreSnapshot(first.Id, snap);
    Check(store.GetDocument(first.Id).Body == first.Body, "Snapshot restoration preserves original text");
    Check(store.Snapshots(first.Id).Count == 2, "Pre-restoration state retained");
    using (var secondOpen = new ProjectStore(path, Path.Combine(root,"backups"))) { Check(secondOpen.ReadOnly, "Second instance is read-only"); Throws<IOException>(() => secondOpen.AddDocument("manuscript", "Forbidden"), "Read-only writes rejected"); }
    var backup = store.Backup(); using (var restored = new ProjectStore(backup)) Check(restored.GetDocument(first.Id).Body == first.Body, "Backup is independently readable");
    Throws<IOException>(() => store.SaveCopy(path), "SaveCopy cannot overwrite live project");
    Throws<IOException>(() => ProjectStore.Create(path, "Forbidden"), "New cannot overwrite existing project");
    var before = File.ReadAllBytes(path); Throws<IOException>(() => store.SaveCopy(backup), "SaveCopy cannot overwrite existing backup"); Check(File.ReadAllBytes(path).SequenceEqual(before), "Rejected copy did not alter project");
    Throws<InvalidDataException>(() => Model.ValidateBody("{\"type\":\"doc\",\"content\":[{\"type\":\"scriptTag\"}]}"), "Unknown editor node rejected");
    Throws<InvalidDataException>(() => Model.ValidateLink("javascript:alert(1)"), "Javascript links rejected");
    Throws<InvalidDataException>(() => Model.ValidateBody("{\"type\":\"doc\",\"content\":[{\"type\":\"image\",\"attrs\":{\"src\":\"file:///secret\"}}]}"), "Local-file image reference rejected");
    var rich = """{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Ein neuer Morgen"}]},{"type":"paragraph","content":[{"type":"text","text":"Grüße aus dem Schreibatelier. ","marks":[{"type":"bold"}]},{"type":"footnote","attrs":{"id":"note1","text":"Diese Fußnote muss erhalten bleiben."}}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Ein Listeneintrag"}]}]}]},{"type":"table","content":[{"type":"tableRow","content":[{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Zelle A"}]}]},{"type":"tableCell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph","content":[{"type":"text","text":"Zelle B"}]}]}]}]}]}""";
    Model.ValidateBody(rich); var richDoc = store.AddDocument("manuscript", "Formatprüfung", body: rich);
    var converter = new ConversionService(Path.Combine(workspace, ".tools"));
    Check(converter.Pandoc is not null && converter.Typst is not null, "Official local converters located");
    foreach (var format in new[] { "docx", "pdf", "rtf", "odt", "html", "md", "epub", "latex", "txt", "opml", "fountain" })
    {
        var output = Path.Combine(root, "export." + format);
        await converter.Export(store, new(format, "Prüfmanuskript", "Testautor", [richDoc.Id]), output);
        Check(new FileInfo(output).Length > 20, format + " export created");
        if (format is "docx" or "rtf" or "odt" or "html" or "md")
        {
            var imported = await converter.Import(output, store, "research");
            Check(Model.PlainText(imported.Document.Body!).Contains("Grüße aus dem Schreibatelier"), format + " text round-trip");
            if (format is "docx" or "odt" or "md") Check(JsonNode.Parse(imported.Document.Body!)!.ToJsonString(new System.Text.Json.JsonSerializerOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping }).Contains("Diese Fußnote muss erhalten bleiben"), format + " footnote round-trip");
        }
    }
    Check(store.Search("Grüße").Count > 0, "Project search includes text");
    var metaDoc = store.GetDocument(richDoc.Id); metaDoc.Meta["custom"] = new JsonObject { ["Ort"] = "BÜCHERHÖHLE" }; store.SaveDocuments([metaDoc]);
    Check(store.Search("bücherhöhle").Count == 1, "Unicode metadata search decodes JSON strings");
    var divided = store.AddDocument("manuscript", "Teilen", body: Model.TextBody("Erster Absatz.\nZweiter Absatz."));
    var tail = store.Split(divided.Id, divided.Revision, Model.TextBody("Erster Absatz."), Model.TextBody("Zweiter Absatz."), "Fortsetzung");
    Check(store.GetDocument(divided.Id).Words + tail.Words == divided.Words && store.Snapshots(divided.Id).Count == 1, "Split retains all words and pre-split snapshot");
    Throws<RevisionConflictException>(() => store.Merge(divided.Id, tail.Id, divided.Revision, tail.Revision), "Stale merge rejected atomically");
    var merged = store.Merge(divided.Id, tail.Id, store.GetDocument(divided.Id).Revision, tail.Revision);
    Check(merged.Words == divided.Words && store.GetDocument(tail.Id).Deleted && store.Snapshots(tail.Id).Count == 1, "Merge retains both snapshots and recoverable source");
    var empty = store.AddDocument("manuscript", "Leer", body: "{\"type\":\"doc\"}");
    var empty2 = store.AddDocument("manuscript", "Leer zwei", body: "{\"type\":\"doc\"}");
    Check(store.Merge(empty.Id, empty2.Id, 0, 0).Words == 0, "Empty documents merge without missing-content exception");
    var originalCount = store.GetProject().Documents.Count;
    Throws<InvalidDataException>(() => store.ImportDocuments([new() { ParentId = "manuscript", Title = "Rollback" }, new() { ParentId = "manuscript", Title = "" }]), "Invalid import batch rejected");
    Check(store.GetProject().Documents.Count == originalCount, "Failed import rolled back preceding documents");
    var replace = store.GetDocument(richDoc.Id); replace.Body = Model.TextBody("Ersetzt"); store.SaveDocuments([replace], snapshotBefore: true);
    Check(store.Snapshots(richDoc.Id).Count == 1, "Project replacement keeps previous document snapshot");
    var noted = JsonNode.Parse(rich)!; noted["content"]![1]!["content"]![0]!["marks"]!.AsArray().Add(new JsonObject { ["type"] = "comment", ["attrs"] = new JsonObject { ["id"] = "comment-1", ["text"] = "Kommentar mit Umlaut: ändern." } });
    var notesDoc = store.AddDocument("manuscript", "Anmerkungen", body: noted.ToJsonString());
    var noteOutput = Path.Combine(root, "endnotes.html");
    await converter.Export(store, new("html", "Anmerkungen", "Autor", [notesDoc.Id], IncludeComments: true, Endnotes: true), noteOutput);
    var noteText = await File.ReadAllTextAsync(noteOutput);
    Check(noteText.Contains("Diese Fußnote muss erhalten bleiben") && noteText.Contains("Kommentare") && noteText.Contains("ändern"), "Endnotes and comment appendix preserve text");
    var protectedBytes = File.ReadAllBytes(path);
    try { await converter.Export(store, new("txt", "Test", "", [notesDoc.Id]), path); throw new Exception("Expected project-overwrite refusal"); } catch (IOException) { Check(File.ReadAllBytes(path).SequenceEqual(protectedBytes), "Export cannot overwrite source project"); }
    var previousTool = converter.Pandoc; converter.Pandoc = Path.Combine(root, "missing.exe"); var protectedOutput = Path.Combine(root, "protected.docx"); File.WriteAllText(protectedOutput, "ORIGINAL");
    try { await converter.Export(store, new("docx", "Test", "", [notesDoc.Id]), protectedOutput); throw new Exception("Expected conversion failure"); } catch (FileNotFoundException) { Check(File.ReadAllText(protectedOutput) == "ORIGINAL", "Converter failure preserves prior output"); } finally { converter.Pandoc = previousTool; }
    var imageFile = Path.Combine(workspace, "tests", "sample.png");
    var imageData = File.ReadAllBytes(imageFile); var imageAsset = store.AddAsset("sample.png", "image/png", imageData);
    var imageDoc = store.AddDocument("manuscript", "Bild", body: new JsonObject { ["type"] = "doc", ["content"] = new JsonArray(new JsonObject { ["type"] = "image", ["attrs"] = new JsonObject { ["src"] = "https://assets.schreibatelier.local/" + imageAsset.Id, ["alt"] = "Testbild" } }) }.ToJsonString());
    Check(store.GetAsset(imageAsset.Id).Data.SequenceEqual(imageData), "Assets are stored losslessly inside SQLite");
    foreach (var format in new[] { "html", "md", "latex", "docx", "odt", "pdf", "epub" })
    {
        var imageOutput = Path.Combine(root, "image." + format); await converter.Export(store, new(format, "Bild", "", [imageDoc.Id]), imageOutput);
        if (format == "html") Check(File.ReadAllText(imageOutput).Contains("data:image/png;base64,"), "HTML embeds images independently of temporary directory");
        else if (format is "md" or "latex") { var value = File.ReadAllText(imageOutput); var match = System.Text.RegularExpressions.Regex.Match(value, "Schreibatelier-assets-[a-f0-9]+/[^)}\\s]+\\.png"); Check(match.Success && File.Exists(Path.Combine(root, match.Value)), format + " image survives temporary-directory cleanup"); }
        else Check(new FileInfo(imageOutput).Length > 50, format + " image export");
        if (format is "docx" or "odt") { var imported = await converter.Import(imageOutput, store, "research"); Check(imported.Document.Body!.Contains("assets.schreibatelier.local"), format + " image round-trip"); }
    }
    var missingImage = store.AddDocument("manuscript", "Fehlendes Bild", body: imageDoc.Body!.Replace(imageAsset.Id, Model.Id(), StringComparison.Ordinal));
    foreach (var format in new[] { "html", "md", "latex", "docx", "odt", "pdf", "epub" })
    {
        var destination = Path.Combine(root, "image." + format); var original = File.ReadAllBytes(destination);
        var assetsBefore = Directory.GetDirectories(root, "Schreibatelier-assets-*").SelectMany(Directory.GetFiles).ToDictionary(file => file, File.ReadAllBytes);
        try { await converter.Export(store, new(format, "Bild", "", [missingImage.Id]), destination); throw new Exception("Expected missing image refusal"); }
        catch (FileNotFoundException) { Check(File.ReadAllBytes(destination).SequenceEqual(original) && assetsBefore.All(asset => File.ReadAllBytes(asset.Key).SequenceEqual(asset.Value)), format + " missing image preserves the existing export and asset files"); }
    }
    var fountain = "Title: Ein Film\n\nINT. HAUS - TAG\n\n@Mara\n(leise)\nHallo.  \n\n@Tom ^\nJa.\n\n# Abschnitt\n= Zusammenfassung\n/* private Notiz\nbleibt erhalten */\n\n> MITTE <\n~ Liedzeile\n\n";
    Check(FountainCodec.Write(FountainCodec.Read(fountain)) == fountain, "Fountain preserves dual-dialogue markers, notes, spaces and blank lines");
    Check(store.History().Count > 0, "Daily word history recorded");
}
using (var reopened = new ProjectStore(path)) Check(reopened.GetProject().Documents.Count >= 5, "Project survives closing and reopening");
File.SetAttributes(path, FileAttributes.ReadOnly);
try { using var readOnly = new ProjectStore(path); Check(readOnly.ReadOnly, "Read-only file opens safely"); Throws<IOException>(() => readOnly.AddDocument("manuscript", "Verboten"), "Read-only file rejects edits"); } finally { File.SetAttributes(path, FileAttributes.Normal); }
var future = Path.Combine(root, "future.schreibprojekt"); File.Copy(path, future);
using (var db = new SqliteConnection("Data Source=" + future + ";Pooling=False")) { db.Open(); using var cmd = db.CreateCommand(); cmd.CommandText = "PRAGMA user_version=99"; cmd.ExecuteNonQuery(); }
var futureBytes = File.ReadAllBytes(future); Throws<InvalidDataException>(() => new ProjectStore(future), "Future schema rejected"); Check(File.ReadAllBytes(future).SequenceEqual(futureBytes), "Future format remains byte-for-byte unchanged");
var broken = Path.Combine(root, "broken.schreibprojekt"); File.WriteAllText(broken, "not a database"); Throws<SqliteException>(() => new ProjectStore(broken), "Corrupt database rejected");
var malformed = Path.Combine(root, "malformed.schreibprojekt"); File.Copy(path, malformed);
using (var db = new SqliteConnection("Data Source=" + malformed + ";Pooling=False")) { db.Open(); using var cmd = db.CreateCommand(); cmd.CommandText = "UPDATE documents SET parent_id=id WHERE id NOT IN ('manuscript','research');"; cmd.ExecuteNonQuery(); }
using (var invalid = new ProjectStore(malformed)) Throws<InvalidDataException>(() => invalid.GetProject(), "Corrupt hierarchy rejected before rendering");
using (var db = new SqliteConnection("Data Source=" + malformed + ";Pooling=False")) { db.Open(); using var cmd = db.CreateCommand(); cmd.CommandText = "UPDATE project SET id='../../outside'"; cmd.ExecuteNonQuery(); }
Throws<InvalidDataException>(() => new ProjectStore(malformed), "Untrusted project ID cannot escape backup directory");
var largePath = Path.Combine(root, "large.schreibprojekt"); var watch = Stopwatch.StartNew();
using (var large = ProjectStore.Create(largePath, "500000 Wörter", Path.Combine(root, "large-backups")))
{
    var text = Model.TextBody(string.Join(' ', Enumerable.Repeat("Romanwort", 500)));
    large.ImportDocuments(Enumerable.Range(0, 1000).Select(i => new DocumentInfo { ParentId = "manuscript", Position = i, Title = "Szene " + i, Body = text }).ToArray());
    Console.WriteLine("MEASURE 1000-section import: " + watch.ElapsedMilliseconds + " ms"); watch.Restart();
    var project = large.GetProject(); Check(project.Documents.Sum(d => d.Words) == 500000 && project.Documents.All(d => d.Body is null), "1000-section project loads summaries without loading 500000 words");
    Console.WriteLine("MEASURE large project summaries: " + watch.ElapsedMilliseconds + " ms"); watch.Restart(); Check(large.Search("Romanwort").Count == 500, "Large project search respects result bound"); Console.WriteLine("MEASURE large search: " + watch.ElapsedMilliseconds + " ms");
}
var crashPath = Path.Combine(root, "crash.schreibprojekt"); string crashId;
using (var fixture = ProjectStore.Create(crashPath, "Abbruchprüfung", Path.Combine(root,"crash-backups"))) crashId = fixture.AddDocument("manuscript", "Text").Id;
var start = new ProcessStartInfo(Environment.ProcessPath!) { UseShellExecute = false, CreateNoWindow = true }; start.ArgumentList.Add("--crash-writer"); start.ArgumentList.Add(crashPath); start.ArgumentList.Add(crashId);
using (var writer = Process.Start(start)!)
{
    try { using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(20)); while (!File.Exists(crashPath + ".ready")) { timeout.Token.ThrowIfCancellationRequested(); if (writer.HasExited) throw new Exception("Crash writer exited before transaction"); await Task.Delay(20, timeout.Token); } }
    finally { if (!writer.HasExited) writer.Kill(true); await writer.WaitForExitAsync(); }
}
using (var recovered = new ProjectStore(crashPath)) Check(Model.PlainText(recovered.GetDocument(crashId).Body!) == "Bestätigt gespeichert.", "Killed writer: committed data survives; uncommitted transaction rolls back");
var appPath = Path.Combine(workspace,".work","native-test.schreibprojekt");
if (!File.Exists(appPath)) { using var appProject = ProjectStore.Create(appPath, "Ein neuer Morgen", Path.Combine(root,"native-backups")); var chapter = appProject.AddDocument("manuscript", "Kapitel 1 · Ankunft", "folder"); appProject.AddDocument(chapter.Id, "Das Haus am See", body: Model.TextBody("Der Morgen lag still über dem See. Auf der anderen Seite des Wassers stand das Haus, das sie seit zwanzig Jahren nicht mehr betreten hatte.\n\nMara blieb am Gartentor stehen. In ihrer Manteltasche lag der Schlüssel, klein und schwer wie ein Versprechen.\n\nHeute würde sie die Tür öffnen."), meta: new JsonObject { ["synopsis"]="Mara kehrt an den Ort ihrer Kindheit zurück. Ein alter Schlüssel führt sie zu einer offenen Frage.", ["status"]="Entwurf", ["tags"]="Mara, Heimkehr", ["color"]="#b77d4e" }); appProject.AddDocument(chapter.Id,"Ein unerwarteter Brief",body:Model.TextBody("Auf dem Küchentisch lag ein Umschlag. Ihr Name stand darauf, in der Handschrift ihres Vaters.")); appProject.AddDocument("manuscript","Kapitel 2 · Spuren","folder"); }
Console.WriteLine($"{passed} checks passed. Artifacts: {root}");
using (var native = new ProjectStore(appPath))
{
    if (!native.GetProject().Documents.Any(d => d.Kind == "asset"))
    {
        foreach (var (name,mime,data) in new[] { ("Prüf-PDF.pdf", "application/pdf", File.ReadAllBytes(Path.Combine(root,"export.pdf"))), ("Recherche.html", "text/html", System.Text.Encoding.UTF8.GetBytes("<!doctype html><meta charset='utf-8'><h1>Lokale Recherche</h1><p>Diese Notiz bleibt im Projekt.</p><script>document.body.innerHTML='UNSAFE SCRIPT RAN';</script>")) })
        { var asset = native.AddAsset(name,mime,data); native.AddDocument("research",name,"asset",meta:new JsonObject { ["assetId"] = asset.Id, ["mime"] = mime }); }
    }
}
