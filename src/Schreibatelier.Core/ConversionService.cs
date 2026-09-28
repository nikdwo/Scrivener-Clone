using System.Diagnostics;
using System.Text;
using System.Text.Json.Nodes;
using System.Xml;
using System.Xml.Linq;

namespace Schreibatelier.Core;

public sealed class ConversionService(string? toolsRoot = null)
{
    public string? Pandoc { get; set; } = Locate("pandoc", toolsRoot);
    public string? Typst { get; set; } = Locate("typst", toolsRoot);
    public static readonly string[] TextFormats = ["docx", "rtf", "odt", "txt", "md", "html", "opml", "fountain"];
    private static string? Locate(string tool, string? root)
    {
        if (root is not null && Directory.Exists(root))
        {
            var match = Directory.EnumerateFiles(root, tool + ".exe", SearchOption.AllDirectories).FirstOrDefault(); if (match is not null) return match;
        }
        foreach (var path in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator)) { var candidate = Path.Combine(path, tool + ".exe"); if (File.Exists(candidate)) return candidate; }
        return null;
    }
    internal static async Task<string> Run(string? exe, IEnumerable<string> args, string cwd, string? input = null, TimeSpan? timeLimit = null)
    {
        if (exe is null || !File.Exists(exe)) throw new FileNotFoundException("Der benötigte Konverter fehlt. Bitte Pandoc und Typst über scripts/install-tools.ps1 installieren oder in den Einstellungen auswählen.");
        using var process = new Process { StartInfo = new(exe) { WorkingDirectory = cwd, UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8 } };
        foreach (var arg in args) process.StartInfo.ArgumentList.Add(arg);
        using var timeout = new CancellationTokenSource(timeLimit ?? TimeSpan.FromMinutes(2));
        process.Start(); var stdout = process.StandardOutput.ReadToEndAsync(timeout.Token); var stderr = process.StandardError.ReadToEndAsync(timeout.Token);
        try
        {
            if (input is not null) { await process.StandardInput.WriteAsync(input.AsMemory(), timeout.Token); await process.StandardInput.FlushAsync(timeout.Token); }
            process.StandardInput.Close();
            await process.WaitForExitAsync(timeout.Token);
            var output = await stdout; var error = await stderr;
            if (process.ExitCode != 0) throw new InvalidDataException("Konvertierung fehlgeschlagen: " + error[..Math.Min(error.Length, 3000)]);
            return output;
        }
        catch
        {
            if (!process.HasExited) { try { process.Kill(true); } catch (InvalidOperationException) { } }
            await process.WaitForExitAsync();
            try { await Task.WhenAll(stdout, stderr); } catch (Exception ex) when (ex is OperationCanceledException or IOException) { }
            if (timeout.IsCancellationRequested) throw new TimeoutException("Die Konvertierung hat das Zeitlimit von zwei Minuten überschritten. Das Projekt wurde nicht verändert.");
            throw;
        }
    }
    private static string Work() { var path = Path.Combine(Path.GetTempPath(), "Schreibatelier", Model.Id()); Directory.CreateDirectory(path); return path; }
    internal static string ExportAssetPath(string work, string relative)
    {
        var root = Path.TrimEndingDirectorySeparator(Path.GetFullPath(work)) + Path.DirectorySeparatorChar;
        var file = Path.GetFullPath(Path.Combine(root, relative));
        if (Path.IsPathRooted(relative) || !file.StartsWith(root, OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal))
            throw new InvalidDataException("Der Bildpfad liegt außerhalb des Exportverzeichnisses.");
        return file;
    }
    public async Task<IReadOnlyList<string>> Export(ProjectStore store, ExportOptions options, string destination)
    {
        if (Path.GetExtension(destination).Equals(".schreibprojekt", StringComparison.OrdinalIgnoreCase) || Path.GetFullPath(destination).Equals(store.FilePath, StringComparison.OrdinalIgnoreCase)) throw new IOException("Eine Projektdatei darf nicht durch eine Textausgabe ersetzt werden.");
        var supported = TextFormats.Concat(["pdf", "epub", "latex"]).ToArray(); if (!supported.Contains(options.Format)) throw new InvalidDataException("Unbekanntes Exportformat.");
        if (options.FontSize is < 8 or > 48 || options.Paper is not ("a4" or "a5" or "letter")) throw new InvalidDataException("Ungültige Seiteneinstellungen.");
        var docs = options.DocumentIds.Distinct().Select(store.GetDocument).Where(d => !d.Deleted && d.Kind != "asset").ToArray();
        var cardIds = store.GetProject().Documents.Where(d => Model.IsStoryCard(d.Meta)).Select(d => d.Id).ToHashSet(StringComparer.Ordinal);
        foreach (var document in docs) document.Body = DocumentCodec.WithoutCardLinks(document.Body!, cardIds);
        if (docs.Length == 0) throw new InvalidDataException("Bitte mindestens einen Textabschnitt auswählen.");
        var work = Work(); var warnings = new List<string>(); var assetsFolder = "Schreibatelier-assets-" + Model.Id();
        try
        {
            var tempOutput = Path.Combine(work, "output." + options.Format);
            if (options.Format == "opml")
            {
                var selected = docs.ToDictionary(x => x.Id);
                XElement Outline(DocumentInfo d) => new("outline", new XAttribute("text", d.Title), new XAttribute("_note", Model.PlainText(d.Body!)), docs.Where(x => x.ParentId == d.Id).OrderBy(x => x.Position).Select(Outline));
                var root = new XDocument(new XElement("opml", new XAttribute("version", "2.0"), new XElement("head", new XElement("title", options.Title)), new XElement("body", docs.Where(d => d.ParentId is null || !selected.ContainsKey(d.ParentId)).Select(Outline))));
                root.Save(tempOutput);
            }
            else if (options.Format is "txt" or "fountain")
            {
                var text = string.Join("\n\n" + options.Separator + "\n\n", docs.Select(d => (options.IncludeTitles ? d.Title + "\n\n" : "") + (options.Format == "fountain" ? FountainCodec.Write(d.Body!) : Model.PlainText(d.Body!))));
                await File.WriteAllTextAsync(tempOutput, text, new UTF8Encoding(false));
            }
            else
            {
                var blocks = new JsonArray();
                string AssetPath(string id)
                {
                    var (info, bytes) = store.GetAsset(id); if (!info.Mime.StartsWith("image/", StringComparison.Ordinal)) throw new InvalidDataException("Ungültiger Bildanhang.");
                    var ext = Path.GetExtension(info.Name).ToLowerInvariant(); if (ext is not (".png" or ".jpg" or ".jpeg" or ".gif" or ".webp")) throw new InvalidDataException("Dieses Bildformat kann nicht ausgegeben werden.");
                    var relative = options.Format is "md" or "latex" ? assetsFolder + "/" + id + ext : id + ext;
                    var file = ExportAssetPath(work, relative); Directory.CreateDirectory(Path.GetDirectoryName(file)!); File.WriteAllBytes(file, bytes); return relative;
                }
                for (var i = 0; i < docs.Length; i++)
                {
                    var d = docs[i];
                    if (options.IncludeTitles) blocks.Add(new JsonObject { ["t"] = "Header", ["c"] = new JsonArray(d.Kind == "folder" ? 1 : 2, new JsonArray(d.Id, new JsonArray(), new JsonArray()), new JsonArray(new JsonObject { ["t"] = "Str", ["c"] = d.Title })) });
                    if (i > 0 && !options.IncludeTitles) foreach (var b in DocumentCodec.ToBlocks(Model.TextBody(options.Separator), AssetPath)) blocks.Add(b!.DeepClone());
                    foreach (var b in DocumentCodec.ToBlocks(d.Body!, AssetPath)) blocks.Add(b!.DeepClone());
                }
                if (options.Endnotes) AppendEndnotes(blocks);
                if (options.IncludeComments)
                {
                    var comments = new List<string>();
                    foreach (var d in docs)
                    {
                        var seen = new HashSet<string>();
                        void Find(JsonNode? n)
                        {
                            if (n is not JsonObject node) return;
                            foreach (var mark in node["marks"]?.AsArray() ?? new()) if (mark?["type"]?.GetValue<string>() == "comment" && seen.Add(mark["attrs"]?["id"]?.GetValue<string>() ?? "")) comments.Add(d.Title + ": " + mark["attrs"]?["text"]?.GetValue<string>());
                            foreach (var child in node["content"]?.AsArray() ?? new()) Find(child);
                        }
                        Find(JsonNode.Parse(d.Body!));
                    }
                    if (comments.Count > 0)
                    {
                        blocks.Add(new JsonObject { ["t"] = "Header", ["c"] = new JsonArray(1, new JsonArray("comments", new JsonArray(), new JsonArray()), new JsonArray(new JsonObject { ["t"] = "Str", ["c"] = "Kommentare" })) });
                        foreach (var b in DocumentCodec.ToBlocks(Model.TextBody(string.Join("\n\n", comments)), AssetPath)) blocks.Add(b!.DeepClone());
                    }
                }
                var ast = new JsonObject { ["pandoc-api-version"] = new JsonArray(1, 23, 1), ["meta"] = new JsonObject { ["title"] = new JsonObject { ["t"] = "MetaString", ["c"] = options.Title }, ["author"] = new JsonObject { ["t"] = "MetaString", ["c"] = options.Author }, ["lang"] = new JsonObject { ["t"] = "MetaString", ["c"] = "de-DE" } }, ["blocks"] = blocks };
                var outputFormat = options.Format == "md" ? "markdown" : options.Format == "pdf" ? "typst" : options.Format == "epub" ? "epub3" : options.Format;
                var args = new List<string> { "--from=json", "--to=" + outputFormat, "--standalone", "--wrap=none", "--resource-path=" + work, "--variable=papersize:" + options.Paper, "--variable=fontsize:" + options.FontSize + "pt", "--variable=mainfont:" + options.Font };
                if (options.TableOfContents) args.Add("--toc");
                if (options.Format == "html") args.Add("--embed-resources");
                var output = options.Format == "pdf" ? Path.Combine(work, "output.typ") : tempOutput; args.Add("--output=" + output);
                // Input is our validated AST. Raw blocks and user-supplied process arguments never enter it.
                await Run(Pandoc, args, work, ast.ToJsonString());
                if (options.Format == "pdf") await Run(Typst, ["compile", "--root", work, "--ignore-system-fonts", output, tempOutput], work);
            }
            if (!File.Exists(tempOutput) || new FileInfo(tempOutput).Length == 0) throw new IOException("Der Konverter hat keine Ausgabe erzeugt.");
            // Complete conversion before touching the destination, then atomically replace on its volume.
            var target = Path.GetFullPath(destination); var staged = Path.Combine(Path.GetDirectoryName(target)!, ".schreibatelier-" + Model.Id() + ".tmp");
            var attachments = Path.Combine(Path.GetDirectoryName(target)!, assetsFolder); var copiedAssets = false;
            try
            {
                if (Directory.Exists(Path.Combine(work, assetsFolder)))
                {
                    if (Directory.Exists(attachments)) throw new IOException("Der Ausgabe-Anhangordner existiert bereits.");
                    Directory.CreateDirectory(attachments); copiedAssets = true;
                    foreach (var file in Directory.GetFiles(Path.Combine(work, assetsFolder))) File.Copy(file, Path.Combine(attachments, Path.GetFileName(file)), false);
                    warnings.Add("Die Bilddateien liegen im Nachbarordner " + assetsFolder + ". Diesen Ordner zusammen mit der Ausgabe weitergeben.");
                }
                File.Copy(tempOutput, staged, false); File.Move(staged, target, true);
            }
            catch { if (copiedAssets) Directory.Delete(attachments, true); throw; }
            finally { if (File.Exists(staged)) File.Delete(staged); }
            return warnings;
        }
        finally { Directory.Delete(work, true); }
    }
    private static void AppendEndnotes(JsonArray blocks)
    {
        var notes = new List<JsonArray>();
        void Walk(JsonNode? node)
        {
            if (node is JsonObject o)
            {
                if (o["t"]?.GetValue<string>() == "Note")
                {
                    notes.Add(o["c"]!.DeepClone().AsArray()); o["t"] = "Superscript"; o["c"] = new JsonArray(new JsonObject { ["t"] = "Str", ["c"] = notes.Count.ToString() }); return;
                }
                foreach (var child in o.ToArray()) Walk(child.Value);
            }
            else if (node is JsonArray a) foreach (var child in a) Walk(child);
        }
        Walk(blocks);
        if (notes.Count == 0) return;
        blocks.Add(new JsonObject { ["t"] = "Header", ["c"] = new JsonArray(1, new JsonArray("notes", new JsonArray(), new JsonArray()), new JsonArray(new JsonObject { ["t"] = "Str", ["c"] = "Anmerkungen" })) });
        for (var i = 0; i < notes.Count; i++)
        {
            var note = notes[i];
            if (note.FirstOrDefault() is JsonObject first && first["t"]?.GetValue<string>() == "Para") { var content = first["c"]!.AsArray(); content.Insert(0,new JsonObject{["t"]="Space"}); content.Insert(0,new JsonObject{["t"]="Str",["c"]=(i+1)+"."}); }
            foreach (var b in note) blocks.Add(b!.DeepClone());
        }
    }
    public async Task<(DocumentInfo Document, List<string> Warnings)> Import(string path, ProjectStore store, string parent)
    {
        var format = Path.GetExtension(path).TrimStart('.').ToLowerInvariant(); if (!TextFormats.Contains(format)) throw new InvalidDataException("Dieses Textformat wird nicht unterstützt.");
        if (new FileInfo(path).Length > 64_000_000) throw new InvalidDataException("Textimporte sind auf 64 MB begrenzt.");
        var title = Path.GetFileNameWithoutExtension(path);
        if (format == "txt") return (store.AddDocument(parent, title, body: Model.TextBody(await File.ReadAllTextAsync(path))), []);
        if (format == "fountain") return (store.AddDocument(parent, title, "script", FountainCodec.Read(await File.ReadAllTextAsync(path))), []);
        var work = Work(); var warnings = new List<string>(); DocumentInfo? imported = null;
        try
        {
            var source = Path.Combine(work, "input." + format); File.Copy(path, source); var media = Path.Combine(work, "media"); Directory.CreateDirectory(media);
            var inputFormat = format == "md" ? "commonmark_x-raw_html-smart" : format == "html" ? "html+raw_html" : format;
            var output = await Run(Pandoc, ["--sandbox", "--from=" + inputFormat, "--to=json", "--extract-media=" + media, source], work);
            var assets = new Dictionary<string, ImportAsset>(StringComparer.OrdinalIgnoreCase);
            string? Image(string name)
            {
                var local = Path.GetFullPath(Path.IsPathRooted(name) ? name : Path.Combine(work, name));
                if (!local.StartsWith(media + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) || !File.Exists(local)) return null;
                var mime = Mime(local); if (!mime.StartsWith("image/", StringComparison.Ordinal)) return null;
                if (!assets.TryGetValue(local, out var asset)) { asset = new(Model.Id(), Path.GetFileName(local), mime, local); assets.Add(local, asset); }
                return "https://assets.schreibatelier.local/" + asset.Id;
            }
            var body = DocumentCodec.FromPandoc(JsonNode.Parse(output)!.AsObject(), Image, warnings); Model.ValidateBody(body);
            warnings = warnings.Distinct().ToList();
            imported = store.AddDocument(parent, title, "text", body, null, assets.Values.ToArray());
            return (imported, warnings);
        }
        finally
        {
            try { Directory.Delete(work, true); }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                // A cleanup failure must not turn a committed import into an apparent failure.
                if (imported is not null) warnings.Add("Importiert; temporäre Importdateien konnten nicht vollständig entfernt werden.");
            }
        }
    }
    public static int ImportOutline(string path, ProjectStore store, string parent)
    {
        using var reader = XmlReader.Create(path, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = 16_000_000 });
        var xml = XDocument.Load(reader); var documents = new List<DocumentInfo>();
        if (xml.Root?.Name != "opml" || xml.Root.Element("body") is null) throw new InvalidDataException("Keine gültige OPML-Gliederung.");
        void Add(XElement element, string p, int depth)
        {
            if (depth > 40 || documents.Count >= 10000) throw new InvalidDataException("Gliederung ist zu groß oder zu tief verschachtelt.");
            var title = (string?)element.Attribute("text"); if (string.IsNullOrWhiteSpace(title)) title = "Abschnitt";
            var d = new DocumentInfo { ParentId = p, Title = title[..Math.Min(title.Length,500)], Kind = element.Elements("outline").Any() ? "folder" : "text", Body = Model.TextBody((string?)element.Attribute("_note") ?? ""), Position = documents.Count(x=>x.ParentId==p) };
            documents.Add(d);
            foreach (var child in element.Elements("outline")) Add(child, d.Id, depth + 1);
        }
        foreach (var el in xml.Root?.Element("body")?.Elements("outline") ?? []) Add(el, parent, 0); return store.ImportDocuments(documents.ToArray());
    }
    public static string Mime(string file) => Path.GetExtension(file).ToLowerInvariant() switch { ".png" => "image/png", ".jpg" or ".jpeg" => "image/jpeg", ".gif" => "image/gif", ".webp" => "image/webp", ".pdf" => "application/pdf", ".mp3" => "audio/mpeg", ".wav" => "audio/wav", ".m4a" => "audio/mp4", ".mp4" => "video/mp4", ".webm" => "video/webm", ".html" or ".htm" => "text/html", _ => "application/octet-stream" };
}
