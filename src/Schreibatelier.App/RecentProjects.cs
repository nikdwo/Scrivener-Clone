using System.IO;
using System.Text.Json;
using Schreibatelier.Core;

namespace Schreibatelier.App;

public sealed record RecentProject(string Title, string FilePath);

public sealed class RecentProjects(string directory)
{
    private readonly string file = Path.Combine(directory, "recent-projects.json");

    public RecentProject[] Read()
    {
        try
        {
            return (JsonSerializer.Deserialize<RecentProject[]>(File.ReadAllText(file), Model.Json) ?? [])
                .Where(p => p is not null && !string.IsNullOrWhiteSpace(p.FilePath) && Path.IsPathFullyQualified(p.FilePath))
                .DistinctBy(p => p.FilePath, StringComparer.OrdinalIgnoreCase).Take(3).ToArray();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException) { return []; }
    }

    public void Remember(string title, string path)
    {
        var recent = new RecentProject(title, Path.GetFullPath(path));
        var entries = new[] { recent }.Concat(Read()).DistinctBy(p => p.FilePath, StringComparer.OrdinalIgnoreCase).Take(3).ToArray();
        var staged = file + "." + Model.Id() + ".tmp";
        try { File.WriteAllText(staged, JsonSerializer.Serialize(entries, Model.Json)); File.Move(staged, file, true); }
        finally { if (File.Exists(staged)) File.Delete(staged); }
    }
}
