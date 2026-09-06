using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Controls;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using Microsoft.Win32;
using Schreibatelier.Core;

namespace Schreibatelier.App;

public sealed class MainWindow : Window
{
    private readonly WebView2 web = new();
    private readonly ConversionService converter;
    private readonly ProofreadingService proof;
    private readonly RecentProjects recentProjects;
    private ProjectStore? store;
    private bool allowClose;
    private readonly string dataDirectory;
    private readonly string[] arguments;
    private JsonObject preferences = new();
    private const string Origin = "https://app.schreibatelier.local/";
    private const string Assets = "https://assets.schreibatelier.local/";
    private bool integrationTest;
    private bool fileOperation;
    private const string AppTitle = "Schreibatelier – Alpha 2";
    private string BackupRoot => Path.Combine(dataDirectory, "Backups");

    public MainWindow(string[] args)
    {
        arguments = args;
        integrationTest = args.Contains("--integration-test");
        dataDirectory = File.Exists(Path.Combine(AppContext.BaseDirectory, "portable.txt"))
            ? Path.Combine(AppContext.BaseDirectory, "Data")
            : integrationTest ? Path.GetFullPath(Path.Combine(Environment.CurrentDirectory, ".work", "app-test"))
            : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Schreibatelier");
        Directory.CreateDirectory(dataDirectory);
        recentProjects = new(dataDirectory);
        var prefsFile = Path.Combine(dataDirectory, "preferences.json");
        if (File.Exists(prefsFile)) try { preferences = JsonNode.Parse(File.ReadAllText(prefsFile))!.AsObject(); } catch (JsonException) { /* A broken preferences file never prevents opening a project. */ }
        converter = new(FindTools());
        var bundledProof = Path.Combine(AppContext.BaseDirectory, "Proofreading");
        proof = new(dataDirectory, Directory.Exists(bundledProof) ? bundledProof : FindTools());
        if (preferences["pandoc"] is JsonValue p) converter.Pandoc = p.GetValue<string>();
        if (preferences["typst"] is JsonValue t) converter.Typst = t.GetValue<string>();
        Title = AppTitle; Width = 1460; Height = 960; MinWidth = 760; MinHeight = 480;
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        var layout = new DockPanel(); var menu = new Menu(); DockPanel.SetDock(menu, Dock.Top);
        foreach (var (title, entries) in new[] {
            ("_Datei", new[] { ("_Neues Projekt", "new"), ("_Öffnen …", "open"), ("_Speichern", "save"), ("Kopie speichern …", "saveCopy"), ("_Importieren …", "import"), ("_Exportieren …", "export"), ("Sicherung erstellen", "backup"), ("Sicherung wiederherstellen …", "restoreBackup"), ("_Beenden", "close") }),
            ("_Ansicht", new[] { ("Schreiben", "write"), ("Pinnwand", "board"), ("Gliederung", "outline"), ("Fokusmodus", "focus"), ("Farbschema wechseln", "theme") }),
            ("_Hilfe", new[] { ("Kurzanleitung", "help"), ("Einstellungen", "settings"), ("Lizenzen", "licenses") }) })
        {
            var group = new MenuItem { Header = title }; foreach (var (label, action) in entries) { var item = new MenuItem { Header = label }; item.Click += (_, _) => Send(new { type = "command", action }); group.Items.Add(item); }
            menu.Items.Add(group);
        }
        layout.Children.Add(menu); layout.Children.Add(web); Content = layout;
        Loaded += async (_, _) => await Initialize(); Closing += OnClosing;
    }
    private static string? FindTools()
    {
        foreach (var root in new[] { Environment.CurrentDirectory, AppContext.BaseDirectory })
            for (var folder = new DirectoryInfo(root); folder is not null; folder = folder.Parent)
            { var tools = Path.Combine(folder.FullName, ".tools"); if (Directory.Exists(tools)) return tools; }
        return null;
    }
    private async Task Initialize()
    {
        try
        {
            var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(dataDirectory, "WebView"), new CoreWebView2EnvironmentOptions("--disable-background-networking"));
            await web.EnsureCoreWebView2Async(environment);
            var core = web.CoreWebView2;
            core.SetVirtualHostNameToFolderMapping("app.schreibatelier.local", Path.Combine(AppContext.BaseDirectory, "Web"), CoreWebView2HostResourceAccessKind.Deny);
            core.Settings.AreHostObjectsAllowed = false; core.Settings.AreDevToolsEnabled = integrationTest; core.Settings.IsStatusBarEnabled = false; core.Settings.AreDefaultScriptDialogsEnabled = false;
            core.Settings.IsPasswordAutosaveEnabled = false; core.Settings.IsGeneralAutofillEnabled = false;
            core.NavigationStarting += (_, e) => { if (!e.Uri.StartsWith(Origin, StringComparison.Ordinal) && !e.Uri.StartsWith(Assets, StringComparison.Ordinal)) e.Cancel = true; };
            core.NewWindowRequested += (_, e) => { e.Handled = true; if (Uri.TryCreate(e.Uri, UriKind.Absolute, out var u) && u.Scheme is "https" or "http" or "mailto") Process.Start(new ProcessStartInfo(e.Uri) { UseShellExecute = true }); };
            core.PermissionRequested += (_, e) => e.State = CoreWebView2PermissionState.Deny;
            core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
            core.WebResourceRequested += Resource;
            core.WebMessageReceived += Message;
            core.ProcessFailed += (_, _) => MessageBox.Show("Der Editorprozess wurde beendet. Zuletzt bestätigte Speicherstände bleiben im Projekt. Bitte die Anwendung neu öffnen.", "Editor nicht verfügbar", MessageBoxButton.OK, MessageBoxImage.Error);
            core.DownloadStarting += (_, e) => e.Cancel = true;
            var file = arguments.FirstOrDefault(x => x.EndsWith(".schreibprojekt", StringComparison.OrdinalIgnoreCase));
            if (file is not null) Switch(integrationTest && !File.Exists(file)
                ? ProjectStore.Create(file, "Alpha-2-Paketprüfung", BackupRoot)
                : new ProjectStore(file, BackupRoot));
            web.Source = new Uri(Origin + "index.html");
        }
        catch (WebView2RuntimeNotFoundException)
        {
            if (MessageBox.Show("Die Microsoft Edge WebView2-Laufzeit fehlt. Die offizielle Downloadseite jetzt öffnen?", AppTitle, MessageBoxButton.YesNo, MessageBoxImage.Information) == MessageBoxResult.Yes)
                Process.Start(new ProcessStartInfo("https://developer.microsoft.com/microsoft-edge/webview2/") { UseShellExecute = true });
            allowClose = true; Close();
        }
        catch (Exception ex) { MessageBox.Show("Start fehlgeschlagen: " + ex.Message, AppTitle, MessageBoxButton.OK, MessageBoxImage.Error); allowClose = true; Close(); }
    }
    private void Resource(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
    {
        var uri = e.Request.Uri;
        if (uri.StartsWith(Origin, StringComparison.Ordinal)) return;
        if (uri.StartsWith(Assets, StringComparison.Ordinal) && store is not null)
        {
            try
            {
                var assetId = new Uri(uri).AbsolutePath.Trim('/');
                if (assetId.Length != 32 || !assetId.All(Uri.IsHexDigit)) throw new InvalidDataException();
                var (info, bytes) = store.GetAsset(assetId);
                var mime = ConversionService.Mime(info.Name);
                var headers = "Content-Type: " + mime + "\r\nAccess-Control-Allow-Origin: " + Origin.TrimEnd('/') + "\r\nX-Content-Type-Options: nosniff\r\nContent-Security-Policy: " + (mime == "application/pdf" ? "" : "sandbox; ") + "default-src 'none'; style-src 'unsafe-inline'; img-src data:\r\n";
                e.Response = web.CoreWebView2.Environment.CreateWebResourceResponse(new MemoryStream(bytes, false), 200, "OK", headers); return;
            }
            catch (Exception ex) when (ex is FileNotFoundException or InvalidDataException) { }
        }
        e.Response = web.CoreWebView2.Environment.CreateWebResourceResponse(new MemoryStream(), 403, "Forbidden", "Content-Type: text/plain");
    }
    private void Send(object data) { if (web.CoreWebView2 is not null) web.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(data, Model.Json)); }
    private ProjectStore Store => store ?? throw new InvalidOperationException("Bitte zuerst ein Projekt öffnen.");
    private void Switch(ProjectStore next)
    {
        try { if (store is not null && !store.ReadOnly) store.Backup(); if (!next.ReadOnly) next.Backup(); }
        catch { next.Dispose(); throw; }
        store?.Dispose(); store = next; var project = Store.GetProject(); Title = project.Title + " – " + AppTitle + (Store.ReadOnly ? " (schreibgeschützt)" : "");
        try { recentProjects.Remember(project.Title, Store.FilePath); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { Debug.WriteLine("Projekt geöffnet, aber Öffnungshistorie nicht gespeichert: " + ex.Message); }
    }
    private void OnClosing(object? sender, CancelEventArgs e)
    {
        if (allowClose) { proof.Dispose(); store?.Dispose(); web.Dispose(); return; }
        e.Cancel = true; Send(new { type = "command", action = "close" });
    }
    private static string Str(JsonObject a, string key) => a[key]?.GetValue<string>() ?? "";
    private static readonly string ProjectFilter = "Schreibatelier-Projekt|*.schreibprojekt";
    private async void Message(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (!e.Source.StartsWith(Origin, StringComparison.Ordinal)) return;
        string? id = null;
        var acquired = false;
        try
        {
            if (e.WebMessageAsJson.Length > 40_000_000) throw new InvalidDataException("Nachricht ist zu groß.");
            var message = JsonNode.Parse(e.WebMessageAsJson)!.AsObject(); id = Str(message, "id"); var action = Str(message, "action"); var a = message["args"]?.AsObject() ?? new();
            if (action is "new" or "open" or "openRecent" or "close" or "import" or "export" or "preview" or "restoreBackup" or "attach")
            {
                if (fileOperation) throw new InvalidOperationException("Bitte den laufenden Dateivorgang abschließen lassen.");
                fileOperation = acquired = true;
            }
            object? result = action switch
            {
                "ready" => new { project = store?.GetProject(), recentProjects = recentProjects.Read(), tools = new { pandoc = converter.Pandoc, typst = converter.Typst }, preferences, integrationTest, storageDirectory = dataDirectory },
                "state" => Store.GetProject(),
                "document" => Store.GetDocument(Str(a, "id")),
                "save" => Store.SaveDocuments(a["documents"]!.Deserialize<DocumentInfo[]>(Model.Json)!),
                "replace" => Store.SaveDocuments(a["documents"]!.Deserialize<DocumentInfo[]>(Model.Json)!, snapshotBefore: true),
                "create" => Store.AddDocument(Str(a, "parent"), Str(a, "title"), Str(a, "kind"), a["body"]?.GetValue<string>(), a["meta"]?.AsObject()),
                "search" => Store.Search(Str(a, "query")),
                "history" => Store.History(),
                "snapshots" => Store.Snapshots(Str(a, "id")),
                "snapshot" => Store.Snapshot(Str(a, "id"), Str(a, "title")),
                "backup" => Store.Backup(),
                _ => await Other(action, a)
            };
            Send(new { id, ok = true, result });
        }
        catch (Exception ex) { Send(new { id, ok = false, error = ex.Message }); if (id is null) MessageBox.Show(ex.Message, "Schreibatelier"); }
        finally { if (acquired) fileOperation = false; }
    }
    private async Task<object?> Other(string action, JsonObject a)
    {
        switch (action)
        {
            case "proofStatus": return proof.Status();
            case "proofCheck": return await proof.Check(a);
            case "proofCancel": proof.Cancel(); return true;
            case "proofPremiumConnect": await proof.ConnectPremium(Str(a, "username"), Str(a, "key")); return true;
            case "proofPremiumDisconnect": proof.DisconnectPremium(); return true;
            case "proofCodexStatus": return await proof.CodexStatus();
            case "proofCodexLogin": return await proof.CodexLogin();
            case "proofCodexLogout": await proof.CodexLogout(); return true;
            case "new":
                var create = new SaveFileDialog { Filter = ProjectFilter, FileName = "Mein Manuskript.schreibprojekt", OverwritePrompt = false };
                if (create.ShowDialog(this) != true) return null;
                Switch(ProjectStore.Create(create.FileName, Path.GetFileNameWithoutExtension(create.FileName), BackupRoot)); return Store.GetProject();
            case "open":
                var open = new OpenFileDialog { Filter = ProjectFilter };
                if (open.ShowDialog(this) != true) return null;
                if (store is not null && string.Equals(Path.GetFullPath(open.FileName), Store.FilePath, StringComparison.OrdinalIgnoreCase)) return Store.GetProject();
                Switch(new ProjectStore(open.FileName, BackupRoot)); return Store.GetProject();
            case "openRecent":
                var recent = recentProjects.Read().FirstOrDefault(p => string.Equals(p.FilePath, Str(a, "path"), StringComparison.OrdinalIgnoreCase))
                    ?? throw new InvalidDataException("Dieses Projekt steht nicht mehr in der Liste. Bitte über „Projekt öffnen“ auswählen.");
                if (!File.Exists(recent.FilePath)) throw new FileNotFoundException("Das Projekt wurde verschoben, gelöscht oder das Laufwerk ist nicht verbunden. Bitte über „Projekt öffnen“ neu auswählen.");
                if (store is not null && string.Equals(recent.FilePath, Store.FilePath, StringComparison.OrdinalIgnoreCase)) return Store.GetProject();
                Switch(new ProjectStore(recent.FilePath, BackupRoot)); return Store.GetProject();
            case "saveCopy":
                var copy = new SaveFileDialog { Filter = ProjectFilter, FileName = Store.GetProject().Title + " – Kopie.schreibprojekt", OverwritePrompt = false };
                if (copy.ShowDialog(this) == true) { Store.SaveCopy(copy.FileName); return copy.FileName; }
                return null;
            case "restoreBackup":
                var backup = new OpenFileDialog { Filter = ProjectFilter, InitialDirectory = store?.BackupDirectory };
                if (backup.ShowDialog(this) != true) return null;
                var restored = new SaveFileDialog { Filter = ProjectFilter, FileName = "Wiederhergestellt.schreibprojekt", OverwritePrompt = false };
                if (restored.ShowDialog(this) != true) return null;
                using (var source = new ProjectStore(backup.FileName, BackupRoot)) source.SaveCopy(restored.FileName);
                Switch(new ProjectStore(restored.FileName, BackupRoot)); return Store.GetProject();
            case "move": Store.Move(Str(a, "id"), Str(a, "parent"), a["index"]!.GetValue<int>()); return Store.GetProject();
            case "split": Store.Split(Str(a, "id"), a["revision"]!.GetValue<long>(), Str(a, "firstBody"), Str(a, "secondBody"), Str(a, "title")); return Store.GetProject();
            case "merge": Store.Merge(Str(a, "firstId"), Str(a, "secondId"), a["firstRevision"]!.GetValue<long>(), a["secondRevision"]!.GetValue<long>()); return Store.GetProject();
            case "trash": Store.Trash(Str(a, "id"), a["deleted"]!.GetValue<bool>()); return Store.GetProject();
            case "settings": Store.SaveSettings(Str(a, "title"), a["settings"]!.AsObject()); Title = Str(a, "title") + " – " + AppTitle; return Store.GetProject();
            case "restoreSnapshot": Store.RestoreSnapshot(Str(a, "id"), Str(a, "snapshotId")); return Store.GetDocument(Str(a, "id"));
            case "attach":
                var attach = new OpenFileDialog { Filter = a["imageOnly"]?.GetValue<bool>() == true ? "Bilder|*.png;*.jpg;*.jpeg;*.gif;*.webp" : "Recherchedateien|*.pdf;*.png;*.jpg;*.jpeg;*.gif;*.webp;*.mp3;*.wav;*.mp4;*.webm;*.m4a;*.html;*.htm|Alle Dateien|*.*" };
                if (attach.ShowDialog(this) != true) return null;
                if (new FileInfo(attach.FileName).Length > 256_000_000) throw new InvalidDataException("Anhänge sind auf 256 MB begrenzt.");
                var info = Store.AddAsset(Path.GetFileName(attach.FileName), ConversionService.Mime(attach.FileName), await File.ReadAllBytesAsync(attach.FileName));
                return new { info, src = Assets + info.Id };
            case "exportAsset":
                var (asset, bytes) = Store.GetAsset(Str(a, "id")); var save = new SaveFileDialog { FileName = asset.Name };
                if (save.ShowDialog(this) == true)
                {
                    if (Path.GetExtension(save.FileName).Equals(".schreibprojekt", StringComparison.OrdinalIgnoreCase)) throw new IOException("Eine Projektdatei darf nicht durch einen Anhang ersetzt werden.");
                    var staged = save.FileName + "." + Model.Id() + ".tmp";
                    try { await File.WriteAllBytesAsync(staged, bytes); File.Move(staged, save.FileName, true); } finally { if (File.Exists(staged)) File.Delete(staged); }
                }
                return null;
            case "import":
                var import = new OpenFileDialog { Filter = "Text und Gliederung|*.docx;*.rtf;*.odt;*.txt;*.md;*.html;*.opml;*.fountain", Multiselect = true };
                if (import.ShowDialog(this) != true) return null;
                var notes = new List<string>(); var count = 0;
                foreach (var path in import.FileNames)
                {
                    try
                    {
                        if (Path.GetExtension(path).Equals(".opml", StringComparison.OrdinalIgnoreCase)) count += ConversionService.ImportOutline(path, Store, Str(a, "parent"));
                        else { var imported = await converter.Import(path, Store); Store.AddDocument(Str(a, "parent"), Path.GetFileNameWithoutExtension(path), Path.GetExtension(path) == ".fountain" ? "script" : "text", imported.Body); notes.AddRange(imported.Warnings); count++; }
                    }
                    catch (Exception ex) when (ex is IOException or InvalidDataException or System.Xml.XmlException) { notes.Add(Path.GetFileName(path) + ": nicht importiert – " + ex.Message); }
                }
                return new { project = Store.GetProject(), warnings = notes, count };
            case "export":
            case "preview":
                var options = a["options"]!.Deserialize<ExportOptions>(Model.Json)!;
                if (action == "preview")
                {
                    var preview = Path.Combine(dataDirectory, "Preview"); Directory.CreateDirectory(preview); var pdf = Path.Combine(preview, Model.Id() + ".pdf");
                    await converter.Export(Store, options with { Format = "pdf" }, pdf);
                    Process.Start(new ProcessStartInfo(pdf) { UseShellExecute = true }); return pdf;
                }
                var export = new SaveFileDialog { FileName = options.Title + "." + (options.Format == "latex" ? "tex" : options.Format), Filter = "Ausgabedatei|*." + (options.Format == "latex" ? "tex" : options.Format) };
                if (export.ShowDialog(this) != true) return null;
                var warnings = await converter.Export(Store, options, export.FileName); return new { path = export.FileName, warnings };
            case "preferences":
                preferences = a.DeepClone().AsObject();
                File.WriteAllText(Path.Combine(dataDirectory, "preferences.json"), preferences.ToJsonString());
                if (preferences["pandoc"] is JsonValue pp && !string.IsNullOrWhiteSpace(pp.GetValue<string>())) converter.Pandoc = pp.GetValue<string>();
                if (preferences["typst"] is JsonValue tt && !string.IsNullOrWhiteSpace(tt.GetValue<string>())) converter.Typst = tt.GetValue<string>();
                return true;
            case "licenses":
                var licenses = Path.Combine(AppContext.BaseDirectory, "THIRD_PARTY_NOTICES.txt");
                return File.Exists(licenses) ? File.ReadAllText(licenses) : "Die Lizenztexte liegen im Quellprojekt unter docs/licenses und im Veröffentlichungspaket in THIRD_PARTY_NOTICES.txt.";
            case "close": if (store is not null && !store.ReadOnly) store.Backup(); allowClose = true; _ = Dispatcher.BeginInvoke(Close); return null;
            case "integrationResult":
                if (!integrationTest) throw new InvalidOperationException("Testbefehl ist deaktiviert.");
                if (store is not null && !store.ReadOnly) store.Backup();
                a["storageDirectory"] = dataDirectory;
                a["backupDirectory"] = store?.BackupDirectory;
                using (var capture = File.Create(Path.Combine(dataDirectory, "native.png"))) await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, capture);
                File.WriteAllText(Path.Combine(dataDirectory, "result.json"), a.ToJsonString()); allowClose = true; _ = Dispatcher.BeginInvoke(Close); return null;
            case "integrationCapture":
                if (!integrationTest) throw new InvalidOperationException("Testbefehl ist deaktiviert.");
                var phase = Str(a, "phase"); if (phase is not ("editor" or "pdf" or "html" or "proof" or "proof-premium" or "proof-chatgpt")) throw new InvalidDataException();
                using (var capture = File.Create(Path.Combine(dataDirectory, phase + ".png"))) await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, capture);
                return true;
            default: throw new InvalidDataException("Unbekannter Befehl: " + action);
        }
    }
}
