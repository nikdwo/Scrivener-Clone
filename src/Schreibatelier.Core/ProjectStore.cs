using Microsoft.Data.Sqlite;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Schreibatelier.Core;

public sealed class ProjectStore : IDisposable
{
    public const int SchemaVersion = 1;
    public string FilePath { get; }
    public bool ReadOnly { get; }
    public string BackupDirectory { get; }
    private readonly FileStream? lease;
    private readonly string connectionString;
    private bool disposed;

    public ProjectStore(string path, string? backupRoot = null)
    {
        FilePath = Path.GetFullPath(path);
        if (!File.Exists(FilePath)) throw new FileNotFoundException("Projekt nicht gefunden.", FilePath);
        try { lease = new FileStream(FilePath + ".lockfile", FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None); }
        catch (IOException) { ReadOnly = true; }
        catch (UnauthorizedAccessException) { ReadOnly = true; }
        if ((File.GetAttributes(FilePath) & FileAttributes.ReadOnly) != 0) ReadOnly = true;
        connectionString = new SqliteConnectionStringBuilder { DataSource = FilePath, Mode = ReadOnly ? SqliteOpenMode.ReadOnly : SqliteOpenMode.ReadWrite, Pooling = false, DefaultTimeout = 3 }.ToString();
        try
        {
            using var db = Connect();
            var version = Convert.ToInt32(Scalar(db, "PRAGMA user_version"));
            if (version != SchemaVersion) throw new InvalidDataException($"Projektformat {version} wird nicht unterstützt (erwartet {SchemaVersion}). Die Datei wurde nicht verändert.");
            if ((string?)Scalar(db, "PRAGMA quick_check") != "ok") throw new InvalidDataException("Die Projektdatei ist beschädigt. Bitte eine Sicherung als neues Projekt öffnen.");
            var id = (string)Scalar(db, "SELECT id FROM project")!;
            if (id.Length != 32 || !id.All(Uri.IsHexDigit)) throw new InvalidDataException("Ungültige Projektkennung.");
            BackupDirectory = Path.Combine(backupRoot ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Schreibatelier", "Backups"), id);
        }
        catch { lease?.Dispose(); throw; }
    }

    public static ProjectStore Create(string path, string title, string? backupRoot = null)
    {
        path = Path.GetFullPath(path);
        // CreateNew prevents an existing project from ever being overwritten by New.
        using (new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None)) { }
        try
        {
            using var db = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = path, Pooling = false }.ToString());
            db.Open();
            Execute(db, """
                PRAGMA journal_mode=DELETE;
                PRAGMA synchronous=FULL;
                PRAGMA user_version=1;
                CREATE TABLE project(id TEXT PRIMARY KEY, title TEXT NOT NULL, settings TEXT NOT NULL);
                CREATE TABLE documents(id TEXT PRIMARY KEY, parent_id TEXT REFERENCES documents(id), position INTEGER NOT NULL, title TEXT NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL, meta TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, words INTEGER NOT NULL DEFAULT 0, plain TEXT NOT NULL DEFAULT '', modified TEXT NOT NULL);
                CREATE INDEX document_parent ON documents(parent_id,position);
                CREATE TABLE assets(id TEXT PRIMARY KEY, name TEXT NOT NULL, mime TEXT NOT NULL, data BLOB NOT NULL);
                CREATE TABLE snapshots(id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id), title TEXT NOT NULL, created TEXT NOT NULL, body TEXT NOT NULL, meta TEXT NOT NULL);
                CREATE TABLE history(day TEXT PRIMARY KEY, words INTEGER NOT NULL);
                """);
            Execute(db, "INSERT INTO project VALUES($id,$title,'{}')", ("$id", Model.Id()), ("$title", title));
            foreach (var (id, name, position) in new[] { ("manuscript", "Manuskript", 0), ("research", "Recherche", 1) })
                Insert(db, new DocumentInfo { Id = id, Title = name, Kind = "folder", Position = position, Body = Model.EmptyBody });
        }
        catch { File.Delete(path); throw; }
        return new ProjectStore(path, backupRoot);
    }

    private SqliteConnection Connect()
    {
        ObjectDisposedException.ThrowIf(disposed, this);
        var db = new SqliteConnection(connectionString);
        db.Open();
        db.CreateFunction<string, string>("unicode_fold", text => text.ToUpperInvariant(), isDeterministic: true);
        Execute(db, "PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;");
        return db;
    }
    private void Writable() { if (ReadOnly) throw new IOException("Dieses Projekt ist schreibgeschützt oder bereits in einem anderen Fenster geöffnet."); }
    private static SqliteCommand Command(SqliteConnection db, string sql, params (string, object?)[] parameters)
    {
        var cmd = db.CreateCommand(); cmd.CommandText = sql;
        foreach (var (name, value) in parameters) cmd.Parameters.AddWithValue(name, value ?? DBNull.Value);
        return cmd;
    }
    private static int Execute(SqliteConnection db, string sql, params (string, object?)[] parameters) { using var cmd = Command(db, sql, parameters); return cmd.ExecuteNonQuery(); }
    private static object? Scalar(SqliteConnection db, string sql, params (string, object?)[] parameters) { using var cmd = Command(db, sql, parameters); return cmd.ExecuteScalar(); }
    private static JsonObject Obj(string text) => JsonNode.Parse(text)?.AsObject() ?? new();
    private static DocumentInfo Read(SqliteDataReader r, bool body) => new()
    {
        Id = r.GetString(0), ParentId = r.IsDBNull(1) ? null : r.GetString(1), Position = r.GetInt32(2), Title = r.GetString(3), Kind = r.GetString(4), Body = body ? r.GetString(5) : null, Meta = Obj(r.GetString(6)), Revision = r.GetInt64(7), Deleted = r.GetBoolean(8), Words = r.GetInt32(9), Modified = r.GetString(10)
    };
    private const string Columns = "id,parent_id,position,title,kind,body,meta,revision,deleted,words,modified";
    private static DocumentInfo Get(SqliteConnection db, string id)
    {
        using var cmd = Command(db, "SELECT " + Columns + " FROM documents WHERE id=$id", ("$id", id)); using var r = cmd.ExecuteReader();
        if (!r.Read()) throw new KeyNotFoundException("Abschnitt nicht gefunden."); var document = Read(r, true); Model.ValidateBody(document.Body!); Model.ValidateMeta(document.Meta, document.Kind); return document;
    }
    public DocumentInfo GetDocument(string id) { using var db = Connect(); return Get(db, id); }
    public ProjectInfo GetProject()
    {
        using var db = Connect();
        string id, title; JsonObject settings;
        using (var cmd = Command(db, "SELECT id,title,settings FROM project")) using (var r = cmd.ExecuteReader()) { r.Read(); id = r.GetString(0); title = r.GetString(1); settings = Obj(r.GetString(2)); }
        using var docs = Command(db, "SELECT id,parent_id,position,title,kind,'' AS body,meta,revision,deleted,words,modified FROM documents ORDER BY position,title"); using var rows = docs.ExecuteReader();
        var list = new List<DocumentInfo>(); while (rows.Read()) list.Add(Read(rows, false));
        var byId = list.ToDictionary(d => d.Id); var validated = new HashSet<string>();
        foreach (var root in new[] { "manuscript", "research" })
            if (!byId.TryGetValue(root, out var d) || d.ParentId is not null || d.Kind != "folder" || d.Deleted) throw new InvalidDataException("Beschädigte Projektbereiche.");
        foreach (var d in list)
        {
            Model.ValidateMeta(d.Meta, d.Kind);
            var chain = new HashSet<string>(); var current = d;
            while (!validated.Contains(current.Id))
            {
                if (!chain.Add(current.Id)) throw new InvalidDataException("Die Projektstruktur enthält einen Kreis.");
                if (current.ParentId is null) { if (current.Id is not ("manuscript" or "research")) throw new InvalidDataException("Abschnitt ohne Projektbereich."); break; }
                if (!byId.TryGetValue(current.ParentId, out current) || current.Kind == "asset") throw new InvalidDataException("Abschnitt mit ungültigem übergeordneten Element.");
            }
            validated.UnionWith(chain);
        }
        return new(id, title, settings, list, ReadOnly, FilePath);
    }
    private static void Insert(SqliteConnection db, DocumentInfo d)
    {
        Model.ValidateMeta(d.Meta, d.Kind);
        var body = d.Body ?? Model.EmptyBody; Model.ValidateBody(body); var plain = Model.PlainText(body);
        Execute(db, "INSERT INTO documents(" + Columns + ",plain) VALUES($id,$parent,$pos,$title,$kind,$body,$meta,0,0,$words,$modified,$plain)", ("$id", d.Id), ("$parent", d.ParentId), ("$pos", d.Position), ("$title", d.Title), ("$kind", d.Kind), ("$body", body), ("$meta", d.Meta.ToJsonString()), ("$words", Model.WordCount(plain)), ("$modified", d.Modified), ("$plain", plain));
    }
    public DocumentInfo AddDocument(string parent, string title, string kind = "text", string? body = null, JsonObject? meta = null)
    {
        Writable();
        if (kind is not ("text" or "folder" or "asset" or "script")) throw new InvalidDataException("Unbekannte Dokumentart.");
        if (string.IsNullOrWhiteSpace(title) || title.Length > 500) throw new InvalidDataException("Bitte einen Titel mit maximal 500 Zeichen eingeben.");
        using var db = Connect(); using var tx = db.BeginTransaction(); var p = Get(db, parent);
        if (p.Deleted || p.Kind == "asset") throw new InvalidDataException("Hier kann kein Abschnitt angelegt werden.");
        var d = new DocumentInfo { ParentId = parent, Title = title, Kind = kind, Body = body ?? Model.EmptyBody, Meta = meta ?? new(), Position = Convert.ToInt32(Scalar(db, "SELECT COALESCE(MAX(position),-1)+1 FROM documents WHERE parent_id=$id", ("$id", parent))) };
        Insert(db, d); tx.Commit(); return GetDocument(d.Id);
    }
    public IReadOnlyList<DocumentInfo> SaveDocuments(DocumentInfo[] changes, bool snapshotBefore = false)
    {
        Writable(); if (changes.Select(x => x.Id).Distinct().Count() != changes.Length) throw new InvalidDataException("Doppelte Abschnitte in einer Änderung.");
        using var db = Connect(); using var tx = db.BeginTransaction();
        foreach (var d in changes)
        {
            var old = Get(db, d.Id);
            if (old.Revision != d.Revision) throw new RevisionConflictException("Der Abschnitt wurde inzwischen geändert. Ihre Eingabe bleibt im Editor; speichern Sie sie separat, bevor Sie neu laden.");
            if (old.Deleted) throw new InvalidDataException("Dieser Abschnitt liegt im Papierkorb.");
            if (string.IsNullOrWhiteSpace(d.Title) || d.Title.Length > 500 || d.Meta.ToJsonString().Length > 2_000_000) throw new InvalidDataException("Titel oder Metadaten sind ungültig.");
            Model.ValidateMeta(d.Meta, old.Kind);
            var body = d.Body ?? old.Body!; Model.ValidateBody(body); var plain = Model.PlainText(body); var words = Model.WordCount(plain);
            if (snapshotBefore) InsertSnapshot(db, old, "Vor Suchen und Ersetzen");
            Execute(db, "UPDATE documents SET title=$title,body=$body,meta=$meta,words=$words,plain=$plain,revision=revision+1,modified=$now WHERE id=$id", ("$id", d.Id), ("$title", d.Title), ("$body", body), ("$meta", d.Meta.ToJsonString()), ("$words", words), ("$plain", plain), ("$now", DateTimeOffset.UtcNow.ToString("O")));
            Execute(db, "INSERT INTO history VALUES($day,$words) ON CONFLICT(day) DO UPDATE SET words=words+excluded.words", ("$day", DateTime.Now.ToString("yyyy-MM-dd")), ("$words", words - old.Words));
        }
        tx.Commit(); return changes.Select(x => GetDocument(x.Id)).ToArray();
    }
    public void Move(string id, string parent, int index)
    {
        Writable(); if (id is "manuscript" or "research") throw new InvalidDataException("Die Projektbereiche können nicht verschoben werden.");
        using var db = Connect(); using var tx = db.BeginTransaction();
        var item = Get(db, id); var target = Get(db, parent);
        if (item.Deleted || target.Deleted || target.Kind == "asset") throw new InvalidDataException("Ungültiges Verschiebeziel.");
        for (DocumentInfo? p = target; p is not null; p = p.ParentId is null ? null : Get(db, p.ParentId)) if (p.Id == id) throw new InvalidDataException("Ein Abschnitt kann nicht in sich selbst verschoben werden.");
        var siblings = new List<string>(); using (var cmd = Command(db, "SELECT id FROM documents WHERE parent_id=$parent AND id<>$id ORDER BY position,id", ("$parent", parent), ("$id", id))) using (var r = cmd.ExecuteReader()) while (r.Read()) siblings.Add(r.GetString(0));
        siblings.Insert(Math.Clamp(index, 0, siblings.Count), id);
        Execute(db, "UPDATE documents SET parent_id=$parent WHERE id=$id", ("$id", id), ("$parent", parent));
        for (var i = 0; i < siblings.Count; i++) Execute(db, "UPDATE documents SET position=$pos,revision=revision+1 WHERE id=$id", ("$id", siblings[i]), ("$pos", i));
        tx.Commit();
    }
    public void Trash(string id, bool deleted)
    {
        Writable(); if (id is "manuscript" or "research") throw new InvalidDataException("Die Projektbereiche bleiben erhalten.");
        using var db = Connect(); using var tx = db.BeginTransaction();
        var d = Get(db, id);
        if (!deleted && d.ParentId is not null && Get(db, d.ParentId).Deleted) throw new InvalidDataException("Bitte zuerst den übergeordneten Ordner wiederherstellen.");
        Execute(db, "WITH RECURSIVE subtree(id) AS (SELECT $id UNION ALL SELECT d.id FROM documents d JOIN subtree s ON d.parent_id=s.id) UPDATE documents SET deleted=$deleted,revision=revision+1 WHERE id IN (SELECT id FROM subtree)", ("$id", id), ("$deleted", deleted ? 1 : 0));
        tx.Commit();
    }
    public void SaveSettings(string title, JsonObject settings)
    {
        Writable(); if (string.IsNullOrWhiteSpace(title) || title.Length > 500 || settings.ToJsonString().Length > 2_000_000) throw new InvalidDataException("Ungültige Projekteinstellungen.");
        if (settings.ContainsKey("recognizeCardNames") && (settings["recognizeCardNames"] is not JsonValue flag || !flag.TryGetValue<bool>(out _))) throw new InvalidDataException("Ungültige Einstellung für die Namenserkennung.");
        if (settings.ContainsKey("styleAnalysis"))
        {
            if (settings["styleAnalysis"] is not JsonObject style || style.Any(pair => pair.Key is not ("repetitions" or "sentences" or "wording" or "automatic") || pair.Value is not JsonValue value || !value.TryGetValue<bool>(out _)))
                throw new InvalidDataException("Ungültige Einstellungen für die Stilanalyse.");
        }
        using var db = Connect(); Execute(db, "UPDATE project SET title=$title,settings=$settings", ("$title", title), ("$settings", settings.ToJsonString()));
    }
    public DocumentInfo Split(string id, long revision, string firstBody, string secondBody, string title)
    {
        Writable(); Model.ValidateBody(firstBody); Model.ValidateBody(secondBody);
        if (string.IsNullOrWhiteSpace(title) || title.Length > 500) throw new InvalidDataException("Ungültiger Titel.");
        using var db = Connect(); using var tx = db.BeginTransaction(); var original = Get(db, id);
        if (original.Revision != revision || original.Deleted) throw new RevisionConflictException("Der Abschnitt wurde inzwischen geändert.");
        var parent = original.ParentId ?? "manuscript";
        InsertSnapshot(db, original, "Vor Teilen");
        Execute(db, "UPDATE documents SET position=position+1,revision=revision+1 WHERE parent_id=$parent AND position>$pos", ("$parent", parent), ("$pos", original.Position));
        var second = new DocumentInfo { ParentId = parent, Position = original.Position + 1, Title = title, Kind = original.Kind == "script" ? "script" : "text", Body = secondBody };
        if (original.Meta["storyCardIds"] is JsonArray cardIds) second.Meta["storyCardIds"] = cardIds.DeepClone();
        Insert(db, second); UpdateBody(db, id, firstBody); tx.Commit(); return GetDocument(second.Id);
    }
    private static void UpdateBody(SqliteConnection db, string id, string body)
    {
        var plain = Model.PlainText(body);
        Execute(db, "UPDATE documents SET body=$body,plain=$plain,words=$words,revision=revision+1,modified=$now WHERE id=$id", ("$id", id), ("$body", body), ("$plain", plain), ("$words", Model.WordCount(plain)), ("$now", DateTimeOffset.UtcNow.ToString("O")));
    }
    public DocumentInfo Merge(string firstId, string secondId, long firstRevision, long secondRevision)
    {
        Writable(); using var db = Connect(); using var tx = db.BeginTransaction(); var first = Get(db, firstId); var second = Get(db, secondId);
        if (first.Revision != firstRevision || second.Revision != secondRevision) throw new RevisionConflictException("Ein Abschnitt wurde inzwischen geändert.");
        if (firstId == secondId || first.Deleted || second.Deleted || second.ParentId != first.ParentId || second.Id is "manuscript" or "research" || first.Kind == "asset" || second.Kind == "asset") throw new InvalidDataException("Diese Abschnitte können nicht zusammengeführt werden.");
        if (Convert.ToInt32(Scalar(db,"SELECT COUNT(*) FROM documents WHERE parent_id=$id AND deleted=0",("$id",secondId)))>0) throw new InvalidDataException("Bitte zuerst die Unterabschnitte des zweiten Abschnitts verschieben.");
        var root = JsonNode.Parse(first.Body!)!; var content = root["content"]?.AsArray() ?? new JsonArray(); root["content"] = content;
        foreach (var child in JsonNode.Parse(second.Body!)!["content"]?.AsArray() ?? new()) content.Add(child!.DeepClone());
        var body = root.ToJsonString(); Model.ValidateBody(body);
        InsertSnapshot(db, first, "Vor Zusammenführen"); InsertSnapshot(db, second, "Vor Zusammenführen");
        UpdateBody(db, firstId, body);
        if (first.Meta.ContainsKey("storyCardIds") || second.Meta.ContainsKey("storyCardIds"))
        {
            first.Meta["storyCardIds"] = new JsonArray((first.Meta["storyCardIds"]?.AsArray() ?? new()).Concat(second.Meta["storyCardIds"]?.AsArray() ?? new())
                .Select(n => n!.GetValue<string>()).Distinct(StringComparer.Ordinal).Select(id => (JsonNode?)JsonValue.Create(id)).ToArray());
            Model.ValidateMeta(first.Meta, first.Kind);
            Execute(db, "UPDATE documents SET meta=$meta WHERE id=$id", ("$id", firstId), ("$meta", first.Meta.ToJsonString()));
        }
        Execute(db, "UPDATE documents SET deleted=1,revision=revision+1 WHERE id=$id", ("$id", secondId));
        tx.Commit(); return GetDocument(firstId);
    }
    private static void InsertSnapshot(SqliteConnection db, DocumentInfo document, string title) => Execute(db, "INSERT INTO snapshots VALUES($id,$doc,$title,$now,$body,$meta)", ("$id", Model.Id()), ("$doc", document.Id), ("$title", title), ("$now", DateTimeOffset.UtcNow.ToString("O")), ("$body", document.Body), ("$meta", document.Meta.ToJsonString()));
    public int ImportDocuments(DocumentInfo[] documents)
    {
        Writable(); using var db = Connect(); using var tx = db.BeginTransaction();
        foreach (var d in documents)
        {
            if (string.IsNullOrWhiteSpace(d.Title) || d.Title.Length > 500 || d.Kind is not ("text" or "folder" or "script" or "asset")) throw new InvalidDataException("Ungültiger Importabschnitt.");
            var parent = Get(db, d.ParentId ?? ""); if (parent.Deleted || parent.Kind == "asset") throw new InvalidDataException("Ungültiges Importziel.");
            Insert(db, d);
        }
        tx.Commit(); return documents.Length;
    }
    public string Snapshot(string documentId, string title)
    {
        Writable(); using var db = Connect(); var d = Get(db, documentId); var id = Model.Id();
        Execute(db, "INSERT INTO snapshots VALUES($id,$doc,$title,$now,$body,$meta)", ("$id", id), ("$doc", documentId), ("$title", title), ("$now", DateTimeOffset.UtcNow.ToString("O")), ("$body", d.Body), ("$meta", d.Meta.ToJsonString())); return id;
    }
    public IReadOnlyList<SnapshotInfo> Snapshots(string documentId)
    {
        using var db = Connect(); using var cmd = Command(db, "SELECT id,document_id,title,created,body,meta FROM snapshots WHERE document_id=$id ORDER BY created DESC", ("$id", documentId)); using var r = cmd.ExecuteReader();
        var list = new List<SnapshotInfo>(); while (r.Read()) list.Add(new(r.GetString(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetString(4), Obj(r.GetString(5)))); return list;
    }
    public void RestoreSnapshot(string documentId, string snapshotId)
    {
        var snapshot = Snapshots(documentId).Single(x => x.Id == snapshotId);
        Snapshot(documentId, "Vor Wiederherstellung"); var d = GetDocument(documentId); d.Body = snapshot.Body; d.Meta = snapshot.Meta; SaveDocuments([d]);
    }
    public AssetInfo AddAsset(string name, string mime, byte[] data)
    {
        Writable(); if (data.LongLength > 256_000_000) throw new InvalidDataException("Anhänge sind auf 256 MB pro Datei begrenzt.");
        using var db = Connect(); var id = Model.Id(); Execute(db, "INSERT INTO assets VALUES($id,$name,$mime,$data)", ("$id", id), ("$name", Path.GetFileName(name)), ("$mime", mime), ("$data", data)); return new(id, Path.GetFileName(name), mime, data.LongLength);
    }
    public (AssetInfo Info, byte[] Data) GetAsset(string id)
    {
        using var db = Connect(); using var cmd = Command(db, "SELECT name,mime,data FROM assets WHERE id=$id", ("$id", id)); using var r = cmd.ExecuteReader();
        if (!r.Read()) throw new FileNotFoundException("Anhang nicht gefunden."); var data = (byte[])r[2]; return (new(id, r.GetString(0), r.GetString(1), data.LongLength), data);
    }
    public IReadOnlyList<object> Search(string query)
    {
        using var db = Connect();
        // ponytail: linear Unicode search; add a Unicode-aware FTS index if measured project searches become slow.
        using var cmd = Command(db, "SELECT id,title,substr(plain,1,220),words FROM documents WHERE deleted=0 AND (instr(unicode_fold(plain),unicode_fold($q))>0 OR instr(unicode_fold(title),unicode_fold($q))>0 OR EXISTS(SELECT 1 FROM json_tree(meta) WHERE type='text' AND instr(unicode_fold(value),unicode_fold($q))>0)) LIMIT 500", ("$q", query));
        using var r = cmd.ExecuteReader(); var result = new List<object>(); while (r.Read()) result.Add(new { id = r.GetString(0), title = r.GetString(1), excerpt = r.GetString(2), words = r.GetInt32(3) }); return result;
    }
    public IReadOnlyList<object> History()
    {
        using var db = Connect(); using var cmd = Command(db, "SELECT day,words FROM history ORDER BY day DESC LIMIT 90"); using var r = cmd.ExecuteReader(); var list = new List<object>(); while (r.Read()) list.Add(new { day = r.GetString(0), words = r.GetInt32(1) }); return list;
    }
    public string Backup()
    {
        Directory.CreateDirectory(BackupDirectory);
        var target = Path.Combine(BackupDirectory, DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fffffff") + ".schreibprojekt");
        SaveCopy(target);
        foreach (var old in Directory.GetFiles(BackupDirectory, "*.schreibprojekt").OrderDescending(StringComparer.Ordinal).Skip(20)) File.Delete(old);
        return target;
    }
    public void SaveCopy(string target)
    {
        target = Path.GetFullPath(target); if (string.Equals(target, FilePath, StringComparison.OrdinalIgnoreCase)) throw new IOException("Bitte einen anderen Dateinamen wählen.");
        using (new FileStream(target, FileMode.CreateNew, FileAccess.Write, FileShare.None)) { }
        try
        {
            using var source = Connect(); using var dest = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = target, Pooling = false }.ToString()); dest.Open(); source.BackupDatabase(dest);
            if ((string?)Scalar(dest, "PRAGMA quick_check") != "ok") throw new IOException("Sicherung konnte nicht validiert werden.");
        }
        catch { File.Delete(target); throw; }
    }
    public void Dispose() { if (disposed) return; disposed = true; lease?.Dispose(); }
}
