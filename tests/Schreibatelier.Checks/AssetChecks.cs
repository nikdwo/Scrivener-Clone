using System.Text.Json;
using Schreibatelier.Core;

static class AssetChecks
{
    public static void Run(string root)
    {
        var count = 0;
        void Check(bool condition, string label) { if (!condition) throw new Exception(label); count++; Console.WriteLine("PASS " + label); }
        void Reject(Action action) { try { action(); } catch (InvalidDataException) { return; } throw new Exception("Invalid asset reference accepted."); }
        const string id = "0123456789abcdef0123456789abcdef";
        var source = "https://assets.schreibatelier.local/" + id;
        string Body(object? attrs) => JsonSerializer.Serialize(new { type = "doc", content = new[] { new { type = "image", attrs } } });
        Check(Model.AssetId(source) == id, "Internal image URL yields the canonical asset ID");
        Model.ValidateBody(Body(new { src = source }));
        foreach (var invalid in new[] { "", "https://example.invalid/" + id, source + "/extra", source + "?query=1", source + "#fragment", "https://assets.schreibatelier.local/" + id.ToUpperInvariant(), "https://assets.schreibatelier.local/../image", "https://assets.schreibatelier.local/%2e%2e", "https://assets.schreibatelier.local/..\\image" })
        {
            Reject(() => Model.AssetId(invalid));
            Reject(() => Model.ValidateBody(Body(new { src = invalid })));
        }
        foreach (var attrs in new object?[] { null, new { }, new { src = 12 } }) Reject(() => Model.ValidateBody(Body(attrs)));
        Check(true, "Image validation rejects missing, non-string and noncanonical asset references");
        var work = Path.Combine(root, "asset-paths");
        Check(ConversionService.ExportAssetPath(work, "images/" + id + ".png") == Path.GetFullPath(Path.Combine(work, "images", id + ".png")), "Export asset path stays inside its work directory");
        foreach (var invalid in new[] { "../outside.png", Path.GetFullPath(Path.Combine(root, "outside.png")), "../asset-paths-neighbor/image.png" })
            Reject(() => ConversionService.ExportAssetPath(work, invalid));
        Check(!Directory.Exists(work), "Rejected export paths are checked without filesystem writes");
        Console.WriteLine($"{count} asset validation checks passed.");
    }
}
