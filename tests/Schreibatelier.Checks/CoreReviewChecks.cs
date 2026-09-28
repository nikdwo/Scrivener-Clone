using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Data.Sqlite;
using Schreibatelier.Core;

static class CoreReviewChecks
{
    public static void ImportCleanupChild(string[] args)
    {
        var media = args.Single(arg => arg.StartsWith("--extract-media=", StringComparison.Ordinal))["--extract-media=".Length..];
        var image = Path.Combine(media, "locked.png"); File.WriteAllBytes(image, [1, 2, 3]); File.SetAttributes(image, FileAttributes.ReadOnly);
        File.WriteAllText(File.ReadAllText(args[^1]), image);
        Console.Write(new JsonObject { ["blocks"] = new JsonArray(new JsonObject { ["t"] = "Para", ["c"] = new JsonArray(new JsonObject { ["t"] = "Image", ["c"] = new JsonArray(new JsonArray("", new JsonArray(), new JsonArray()), new JsonArray(), new JsonArray(image, "")) }) }) }.ToJsonString());
    }
    public static async Task RunChild(string[] args)
    {
        File.WriteAllText(args[2], Environment.ProcessId.ToString());
        if (args[1] == "echo")
        {
            // The converter reads the caller's stdin codepage and emits UTF-8, independently of its own console.
            var codepage = int.Parse(args[3]);
            using var reader = new StreamReader(Console.OpenStandardInput(), CodePagesEncodingProvider.Instance.GetEncoding(codepage) ?? Encoding.GetEncoding(codepage));
            Console.OutputEncoding = new UTF8Encoding(false);
            Console.Write(await reader.ReadToEndAsync()); return;
        }
        if (args[1] == "exit") { Console.Error.Write("Test converter failed"); Environment.ExitCode = 7; return; }
        if (args[1] == "arguments") { Console.Write(JsonSerializer.Serialize(args[3..])); return; }
        if (args[1] == "stdin-bytes")
        {
            using var bytes = new MemoryStream(); await Console.OpenStandardInput().CopyToAsync(bytes);
            Console.Write(Convert.ToHexString(bytes.ToArray())); return;
        }
        if (args[1] == "encoding-compare")
        {
            var value = "Grüße – 🖋️"; var directory = Path.GetDirectoryName(args[2])!;
            var baseline = await LegacyOutput(directory, args[2] + ".baseline", value);
            var actual = await ConversionService.Run(Environment.ProcessPath!, ["--converter-review-child", "stdin-bytes", args[2] + ".native"], directory, value, TimeSpan.FromSeconds(10));
            Console.Write(actual == baseline ? "same" : $"different: {baseline} / {actual}"); return;
        }
        if (args[1] == "large-output")
        {
            Console.OutputEncoding = new UTF8Encoding(false);
            await Task.WhenAll(Console.Out.WriteAsync(new string('ä', 100_000)), Console.Error.WriteAsync(new string('ö', 100_000))); return;
        }
        if (args[1] == "gate-echo")
        {
            var input = await Console.In.ReadToEndAsync(); await WaitForFile(args[2] + ".release"); Console.Write(input); return;
        }
        if (args[1] is "tree" or "tree-exit")
        {
            var start = new ProcessStartInfo(Environment.ProcessPath!) { UseShellExecute = false, CreateNoWindow = true };
            foreach (var arg in new[] { "--converter-review-child", "block", args[2] + ".child" }) start.ArgumentList.Add(arg);
            using var child = Process.Start(start)!;
            await WaitForFile(args[2] + ".child");
            if (args[1] == "tree-exit") return;
            await Task.Delay(Timeout.Infinite);
        }
        await Task.Delay(Timeout.Infinite);
    }

    private static async Task WaitForFile(string path)
    {
        var watch = Stopwatch.StartNew();
        while (!File.Exists(path))
        {
            if (watch.Elapsed > TimeSpan.FromSeconds(10)) throw new TimeoutException("Converter fixture did not become ready: " + path);
            await Task.Delay(10);
        }
    }

    private static async Task<string> LegacyOutput(string root, string pid, string input, string mode = "stdin-bytes")
    {
        var start = new ProcessStartInfo(Environment.ProcessPath!) { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = root, RedirectStandardInput = true, RedirectStandardOutput = true, StandardOutputEncoding = Encoding.UTF8 };
        foreach (var arg in new[] { "--converter-review-child", mode, pid }) start.ArgumentList.Add(arg);
        if (mode == "echo") start.ArgumentList.Add(Console.InputEncoding.CodePage.ToString());
        using var process = Process.Start(start)!;
        try
        {
            var output = process.StandardOutput.ReadToEndAsync();
            await process.StandardInput.WriteAsync(input); await process.StandardInput.FlushAsync(); process.StandardInput.Close();
            await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(10));
            return await output;
        }
        finally { if (!process.HasExited) { process.Kill(true); await process.WaitForExitAsync(); } }
    }

    public static async Task Run(string root, string workspace)
    {
        var passed = 0;
        void Check(bool ok, string label) { if (!ok) throw new Exception("FAILED: " + label); passed++; Console.WriteLine("PASS " + label); }
        void Throws<T>(Action action, string label) where T : Exception
        {
            try { action(); } catch (T) { Check(true, label); return; }
            throw new Exception("FAILED (no exception): " + label);
        }
        async Task ThrowsAsync<T>(Func<Task> action, string label) where T : Exception
        {
            try { await action(); } catch (T) { Check(true, label); return; }
            throw new Exception("FAILED (no exception): " + label);
        }

        var quoted = JsonNode.Parse("""{"blocks":[{"t":"Para","c":[{"t":"Quoted","c":[{"t":"DoubleQuote"},[{"t":"Str","c":"Mara"},{"t":"Space"},{"t":"Quoted","c":[{"t":"SingleQuote"},[{"t":"Emph","c":[{"t":"Str","c":"sagt"}]}]]}]]}]}]}""")!.AsObject();
        var body = DocumentCodec.FromPandoc(quoted, _ => null, []);
        Check(Model.PlainText(body) == "\"Mara 'sagt'\"", "Nested Pandoc quotes retain delimiters");
        Check(JsonNode.Parse(body)!["content"]![0]!["content"]!.AsArray().Any(n => n?["text"]?.GetValue<string>() == "sagt" && n["marks"]?[0]?["type"]?.GetValue<string>() == "italic"), "Quoted text retains nested formatting");

        var path = Path.Combine(root, "review.schreibprojekt");
        using var store = ProjectStore.Create(path, "Review", Path.Combine(root, "review-backups"));
        var large = store.AddDocument("manuscript", "Large snapshots", body: Model.TextBody(new string('a', 250_000)), meta: new JsonObject { ["notes"] = new string('b', 100_000) });
        var snapshotIds = Enumerable.Range(0, 12).Select(i => store.Snapshot(large.Id, "Stand " + i)).ToArray();
        var summaries = store.Snapshots(large.Id);
        var summaryJson = JsonSerializer.SerializeToNode(summaries, Model.Json)!.AsArray();
        Check(summaries.Count == 12 && summaryJson.All(n => n!.AsObject().Count == 4 && n["body"] is null && n["meta"] is null) && summaryJson.ToJsonString().Length < 10_000, "Snapshot list excludes every body and metadata payload");
        var detail = store.GetSnapshot(large.Id, snapshotIds[3]);
        Check(detail.Body == large.Body && detail.Meta.ToJsonString() == large.Meta.ToJsonString(), "Snapshot detail retrieves exactly the selected content");
        var other = store.AddDocument("research", "Other");
        Throws<KeyNotFoundException>(() => store.GetSnapshot(other.Id, snapshotIds[3]), "Snapshot detail rejects a foreign document ID");
        Throws<KeyNotFoundException>(() => store.GetSnapshot(large.Id, Model.Id()), "Snapshot detail rejects a missing snapshot ID");
        var changed = store.GetDocument(large.Id); changed.Body = Model.TextBody("Changed"); store.SaveDocuments([changed]);
        store.RestoreSnapshot(large.Id, snapshotIds[3]);
        Check(store.GetDocument(large.Id).Body == large.Body && store.Snapshots(large.Id).Count == 13, "Snapshot restore reads detail and preserves the previous state");

        long AssetCount()
        {
            using var db = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = path, Pooling = false }.ToString()); db.Open();
            using var cmd = db.CreateCommand(); cmd.CommandText = "SELECT COUNT(*) FROM assets"; return (long)cmd.ExecuteScalar()!;
        }
        var assetPath = Path.Combine(workspace, "tests", "sample.png");
        var firstAsset = new ImportAsset(Model.Id(), "first.png", "image/png", assetPath);
        var missingAsset = new ImportAsset(Model.Id(), "missing.png", "image/png", Path.Combine(root, "missing.png"));
        var documentCount = store.GetProject().Documents.Count;
        Throws<FileNotFoundException>(() => store.AddDocument("research", "Interrupted import", "text", Model.EmptyBody, null, [firstAsset, missingAsset]), "Mid-import asset failure rejects the whole transaction");
        Check(AssetCount() == 0 && store.GetProject().Documents.Count == documentCount, "Mid-import rollback removes the earlier image and document");
        Throws<InvalidDataException>(() => store.AddDocument("research", "Malformed", "text", "{\"type\":\"wrong\"}", null, [firstAsset]), "Malformed imported document is rejected");
        Throws<KeyNotFoundException>(() => store.AddDocument("missing", "No parent", "text", Model.EmptyBody, null, [firstAsset]), "Unknown import parent is rejected");
        store.Trash(other.Id, true);
        Throws<InvalidDataException>(() => store.AddDocument(other.Id, "Deleted parent", "text", Model.EmptyBody, null, [firstAsset]), "Deleted import parent is rejected");
        Check(AssetCount() == 0 && store.GetProject().Documents.Count == documentCount, "Invalid imports never leave assets or documents");
        var assetDocument = store.AddDocument("research", "Atomic image", "text", new JsonObject { ["type"] = "doc", ["content"] = new JsonArray(new JsonObject { ["type"] = "image", ["attrs"] = new JsonObject { ["src"] = "https://assets.schreibatelier.local/" + firstAsset.Id } }) }.ToJsonString(), null, [firstAsset]);
        Check(AssetCount() == 1 && store.GetAsset(firstAsset.Id).Data.SequenceEqual(File.ReadAllBytes(assetPath)) && store.GetDocument(assetDocument.Id).Body == assetDocument.Body, "Successful import commits document and image together");

        var converter = new ConversionService(Path.Combine(workspace, ".tools"));
        var sourceText = "\"Mara\" sagt 'ja', „wirklich“ und »heute«. Mara's – jetzt -- bleibt...";
        var markdown = Path.Combine(root, "quotes.md"); await File.WriteAllTextAsync(markdown, sourceText);
        var imported = await converter.Import(markdown, store, "research");
        Check(Model.PlainText(imported.Document.Body!) == sourceText, "Markdown import preserves original quotes, apostrophes and punctuation");
        var html = Path.Combine(root, "quotes.html"); await File.WriteAllTextAsync(html, "<p><q>Mara <em>sagt</em></q></p>");
        var htmlImport = await converter.Import(html, store, "research");
        Check(Model.PlainText(htmlImport.Document.Body!) == "\"Mara sagt\"", "HTML q import retains quotation delimiters");
        foreach (var format in new[] { "docx", "odt" })
        {
            var output = Path.Combine(root, "quotes." + format); await converter.Export(store, new(format, "", "", [imported.Document.Id], IncludeTitles: false, TableOfContents: false), output);
            Check(Model.PlainText((await converter.Import(output, store, "research")).Document.Body!).Trim() == sourceText, format + " round-trip retains all punctuation");
        }
        var imageFile = Path.Combine(root, "atomic-image.docx"); await converter.Export(store, new("docx", "", "", [assetDocument.Id]), imageFile);
        for (var i = 0; i < 2; i++)
        {
            var result = await converter.Import(imageFile, store, "research");
            Check(result.Document.Body!.Contains("assets.schreibatelier.local/") && AssetCount() == i + 2, "Repeated image import commits a separate complete document " + i);
        }
        var countBeforeFailure = store.GetProject().Documents.Count; var assetsBeforeFailure = AssetCount();
        await ThrowsAsync<KeyNotFoundException>(() => converter.Import(imageFile, store, "missing"), "Converted image import rejects a missing parent");
        Check(AssetCount() == assetsBeforeFailure && store.GetProject().Documents.Count == countBeforeFailure, "Rejected converted image import leaves project unchanged");

        var cleanupMarker = Path.Combine(root, "cleanup-path.txt"); var cleanupSource = Path.Combine(root, "cleanup.html");
        await File.WriteAllTextAsync(cleanupSource, cleanupMarker);
        try
        {
            var cleanupImport = await new ConversionService { Pandoc = Environment.ProcessPath }.Import(cleanupSource, store, "research");
            Check(store.GetDocument(cleanupImport.Document.Id).Body == cleanupImport.Document.Body && cleanupImport.Warnings.Any(warning => warning.Contains("temporäre Importdateien")), "Post-commit cleanup failure returns the successful import with a warning");
        }
        finally
        {
            if (File.Exists(cleanupMarker))
            {
                var image = Path.GetFullPath(File.ReadAllText(cleanupMarker)); var folder = Path.GetDirectoryName(Path.GetDirectoryName(image)!)!;
                var tempRoot = Path.GetFullPath(Path.Combine(Path.GetTempPath(), "Schreibatelier")) + Path.DirectorySeparatorChar;
                if (!folder.StartsWith(tempRoot, StringComparison.OrdinalIgnoreCase) || !Guid.TryParseExact(Path.GetFileName(folder), "N", out _)) throw new IOException("Unexpected cleanup fixture path.");
                if (File.Exists(image)) File.SetAttributes(image, FileAttributes.Normal);
                Directory.Delete(folder, true);
            }
        }

        await RunConverterProcesses(root);
        Console.WriteLine($"{passed} core review checks passed.");
    }

    public static async Task RunConverterProcesses(string root)
    {
        var passed = 0;
        void Check(bool ok, string label) { if (!ok) throw new Exception("FAILED: " + label); passed++; Console.WriteLine("PASS " + label); }
        async Task ThrowsAsync<T>(Func<Task> action, string label) where T : Exception
        {
            try { await action(); } catch (T) { Check(true, label); return; }
            throw new Exception("FAILED (no exception): " + label);
        }
        static Process? OpenFixture(string file)
        {
            if (!File.Exists(file)) return null;
            try { return Process.GetProcessById(int.Parse(File.ReadAllText(file))); } catch (ArgumentException) { return null; }
        }

        var normalPid = Path.Combine(root, "converter-normal.pid");
        Check(await LegacyOutput(root, normalPid, "Grüße", "echo") == "Grüße", "Echo fixture decodes the declared stdin encoding and emits UTF-8 with existing Process.Start");
        Check(await ConversionService.Run(Environment.ProcessPath!, ["--converter-review-child", "echo", normalPid, Console.InputEncoding.CodePage.ToString()], root, "Grüße", TimeSpan.FromSeconds(10)) == "Grüße", "Converter reads stdin and drains stdout normally");
        var argumentPid = Path.Combine(root, "converter-arguments.pid");
        string[] arguments = ["", "two words", "Grüße", "a\"b", "a\\\"b", "a\\\\\"b", "C:\\path with spaces\\", "\\", "\"", "line\tbreak"];
        var echoedArguments = await ConversionService.Run(Environment.ProcessPath!, ["--converter-review-child", "arguments", argumentPid, .. arguments], root, timeLimit: TimeSpan.FromSeconds(10));
        Check(JsonSerializer.Deserialize<string[]>(echoedArguments)!.SequenceEqual(arguments), "Converter preserves empty, quoted, Unicode and trailing-backslash arguments");
        var encodingPid = Path.Combine(root, "converter-encoding.pid"); var input = "Grüße – 🖋️";
        var baseline = await LegacyOutput(root, encodingPid, input);
        var encoded = await ConversionService.Run(Environment.ProcessPath!, ["--converter-review-child", "stdin-bytes", encodingPid], root, input, TimeSpan.FromSeconds(10));
        Check(encoded == baseline, "Converter preserves the existing stdin encoding and BOM behavior");
        Check(await ConversionService.Run(Environment.ProcessPath!, ["--converter-review-child", "encoding-compare", encodingPid], root, timeLimit: TimeSpan.FromSeconds(10)) == "same", "Converter preserves stdin encoding without an attached console");
        Check(await ConversionService.Run(Environment.ProcessPath!, ["--converter-review-child", "large-output", normalPid], root, timeLimit: TimeSpan.FromSeconds(10)) == new string('ä', 100_000), "Converter drains large UTF-8 stdout and stderr concurrently");
        await ThrowsAsync<ArgumentException>(() => ConversionService.Run(Environment.ProcessPath!, ["invalid\0argument"], root), "Converter rejects an embedded null before native launch");
        await ThrowsAsync<System.ComponentModel.Win32Exception>(() => ConversionService.Run(Environment.ProcessPath!, [], Path.Combine(root, "missing-directory")), "Invalid working directory fails without starting a converter");
        Check(await ConversionService.Run(Environment.ProcessPath!, ["--converter-review-child", "echo", normalPid, Console.InputEncoding.CodePage.ToString()], root, "after failure", TimeSpan.FromSeconds(10)) == "after failure", "Converter starts successfully after native launch failures");
        var failedPid = Path.Combine(root, "converter-failed.pid");
        await ThrowsAsync<InvalidDataException>(() => ConversionService.Run(Environment.ProcessPath!, ["--converter-review-child", "exit", failedPid], root, timeLimit: TimeSpan.FromSeconds(10)), "Converter early exit reports failure without hanging");
        await ThrowsAsync<IOException>(() => ConversionService.Run(Environment.ProcessPath!, ["--converter-review-child", "exit", failedPid], root, new string('x', 4_000_000), TimeSpan.FromSeconds(10)), "Converter exiting during stdin reports failure without hanging");
        var blockedPid = Path.Combine(root, "converter-blocked.pid"); var watch = Stopwatch.StartNew();
        await ThrowsAsync<TimeoutException>(() => ConversionService.Run(Environment.ProcessPath!, ["--converter-review-child", "tree", blockedPid], root, new string('x', 4_000_000), TimeSpan.FromSeconds(2)), "Converter timeout includes blocked stdin");
        Check(watch.Elapsed < TimeSpan.FromSeconds(15), "Blocked converter respects the full exchange deadline");
        foreach (var file in new[] { blockedPid, blockedPid + ".child" })
        {
            Check(File.Exists(file), "Timeout fixture started " + Path.GetFileName(file));
            var alive = false;
            try { using var process = Process.GetProcessById(int.Parse(File.ReadAllText(file))); alive = !process.HasExited; } catch (ArgumentException) { }
            Check(!alive, "Timed-out converter process is stopped: " + Path.GetFileName(file));
        }
        var orphanPid = Path.Combine(root, "converter-exited-parent.pid");
        var parallelPid = Path.Combine(root, "converter-parallel.pid");
        var parallel = ConversionService.Run(Environment.ProcessPath!, ["--converter-review-child", "gate-echo", parallelPid], root, "parallel survives", TimeSpan.FromSeconds(10));
        try
        {
            await WaitForFile(parallelPid);
            watch.Restart();
            await ThrowsAsync<TimeoutException>(() => ConversionService.Run(Environment.ProcessPath!, ["--converter-review-child", "tree-exit", orphanPid], root, timeLimit: TimeSpan.FromSeconds(1)).WaitAsync(TimeSpan.FromSeconds(6)), "Converter timeout covers inherited pipes after the direct process exits");
            Check(watch.Elapsed < TimeSpan.FromSeconds(5), "Inherited pipes respect the conversion deadline");
            using (var direct = OpenFixture(orphanPid)) Check(direct is null || direct.HasExited, "Inherited-pipe fixture exited its direct converter before timeout");
            using (var survivor = OpenFixture(parallelPid)) Check(survivor is not null && !survivor.HasExited, "Timing out one conversion leaves another conversion running");
            File.WriteAllText(parallelPid + ".release", "release");
            Check(await parallel == "parallel survives", "Parallel conversion completes after its neighbor times out");
            Check(File.Exists(orphanPid + ".child"), "Inherited-pipe fixture started its child before its parent exited");
            using var orphan = OpenFixture(orphanPid + ".child");
            Check(orphan is null || orphan.HasExited, "Timeout stops inherited-pipe child before returning even after the direct converter exited");
        }
        finally
        {
            foreach (var file in new[] { orphanPid, orphanPid + ".child", parallelPid })
            {
                using var fixture = OpenFixture(file);
                if (fixture is not null && !fixture.HasExited) { fixture.Kill(true); await fixture.WaitForExitAsync(); }
            }
            try { await parallel; } catch (Exception ex) when (ex is IOException or InvalidDataException or TimeoutException) { }
        }
        Console.WriteLine($"{passed} converter process checks passed.");
    }
}
