using System.Text.Json;
using Microsoft.Data.Sqlite;
using Schreibatelier.Core;

static class NativeReviewFixtures
{
    public static async Task Run(string[] args)
    {
        if (args[0] == "--native-review-lock-file")
        {
            using var handle = new FileStream(args[1], FileMode.Open, FileAccess.Read, FileShare.Read);
            File.WriteAllText(args[2], "ready");
            await Console.In.ReadLineAsync();
            return;
        }
        if (args[0] == "--native-review-lease")
        {
            using var store = new ProjectStore(args[1]);
            if (store.ReadOnly) throw new Exception("Candidate project lease was not released.");
            return;
        }
        if (args[0] != "--native-review-fixtures") throw new ArgumentException("Unknown native review fixture mode.");
        var root = Path.GetFullPath(args[1]); Directory.CreateDirectory(root);
        var data = Path.Combine(root, ".work", "app-test"); Directory.CreateDirectory(data);
        var backups = Path.Combine(data, "Backups");
        var a = Path.Combine(root, "A.schreibprojekt");
        string document;
        using (var store = ProjectStore.Create(a, "Projekt A", backups))
            document = store.AddDocument("manuscript", "Szene A", body: Model.TextBody("Text in A.")).Id;
        var b = Path.Combine(root, "B-invalid.schreibprojekt"); File.Copy(a, b);
        using (var db = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = b, Pooling = false }.ToString()))
        {
            db.Open(); using var command = db.CreateCommand();
            command.CommandText = "UPDATE documents SET parent_id=id WHERE id=$id";
            command.Parameters.AddWithValue("$id", document); command.ExecuteNonQuery();
        }
        var c = Path.Combine(root, "C-backup-failure.schreibprojekt");
        using (var store = ProjectStore.Create(c, "Projekt C", backups))
        {
            Directory.CreateDirectory(backups);
            File.WriteAllText(store.BackupDirectory, "A file intentionally blocks this test project's backup directory.");
        }
        File.WriteAllText(Path.Combine(data, "recent-projects.json"), JsonSerializer.Serialize(new[] {
            new { title = "Ungültiges Projekt B", filePath = b }, new { title = "Sicherungsfehler C", filePath = c }
        }, Model.Json));
        File.WriteAllText(Path.Combine(root, "fixtures.json"), JsonSerializer.Serialize(new { a, b, c, data, document }, Model.Json));
    }
}
