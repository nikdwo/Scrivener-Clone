using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Schreibatelier.Core;

public static partial class Model
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = false };
    public static string Id() => Guid.NewGuid().ToString("N");
    public static string EmptyBody => "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\"}]}";
    public static string TextBody(string text) => JsonSerializer.Serialize(new { type = "doc", content = text.Replace("\r", "").Split('\n').Select(t => new { type = "paragraph", content = t.Length == 0 ? Array.Empty<object>() : new object[] { new { type = "text", text = t } } }) }, Json);
    public static string PlainText(string body)
    {
        var root = JsonNode.Parse(body);
        var result = new System.Text.StringBuilder();
        void Walk(JsonNode? node)
        {
            if (node is not JsonObject o) return;
            var type = o["type"]?.GetValue<string>();
            if (type == "footnote") return;
            if (o["text"] is JsonValue t) result.Append(t.GetValue<string>());
            if (o["content"] is JsonArray children) foreach (var child in children) Walk(child);
            if (type is "paragraph" or "heading" or "hardBreak" or "script") result.Append('\n');
        }
        Walk(root);
        return result.ToString().TrimEnd();
    }
    [GeneratedRegex(@"[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’\-][\p{L}\p{M}\p{N}]+)*", RegexOptions.CultureInvariant)]
    private static partial Regex Words();
    public static int WordCount(string text) => Words().Count(text);
    public static void ValidateBody(string body)
    {
        if (body.Length > 32_000_000) throw new InvalidDataException("Der Abschnitt überschreitet 32 MB. Bitte teilen Sie ihn auf.");
        using var parsed = JsonDocument.Parse(body, new JsonDocumentOptions { MaxDepth = 64 });
        if (parsed.RootElement.GetProperty("type").GetString() != "doc") throw new InvalidDataException("Ungültiges Textdokument.");
        ValidateNode(parsed.RootElement, 0);
    }
    private static readonly HashSet<string> AllowedNodes = ["doc", "paragraph", "heading", "text", "hardBreak", "horizontalRule", "blockquote", "bulletList", "orderedList", "listItem", "codeBlock", "image", "table", "tableRow", "tableCell", "tableHeader", "footnote", "script"];
    private static readonly HashSet<string> AllowedMarks = ["bold", "italic", "underline", "strike", "code", "link", "highlight", "textStyle", "subscript", "superscript", "comment", "revision"];
    private static void ValidateNode(JsonElement n, int depth)
    {
        if (depth > 48 || !n.TryGetProperty("type", out var type) || !AllowedNodes.Contains(type.GetString() ?? "")) throw new InvalidDataException("Nicht unterstütztes Textelement.");
        if (n.TryGetProperty("marks", out var marks)) foreach (var mark in marks.EnumerateArray())
        {
            if (!AllowedMarks.Contains(mark.GetProperty("type").GetString() ?? "")) throw new InvalidDataException("Unbekannte Textmarkierung.");
            if (mark.GetProperty("type").GetString() == "link" && mark.TryGetProperty("attrs", out var a) && a.TryGetProperty("href", out var href))
                ValidateLink(href.GetString() ?? "");
        }
        if (type.GetString() == "image" && n.TryGetProperty("attrs", out var attrs) && attrs.TryGetProperty("src", out var src))
        {
            var s = src.GetString() ?? "";
            if (!s.StartsWith("https://assets.schreibatelier.local/", StringComparison.Ordinal)) throw new InvalidDataException("Bilder müssen ins Projekt importiert werden.");
        }
        if (n.TryGetProperty("content", out var children)) foreach (var child in children.EnumerateArray()) ValidateNode(child, depth + 1);
    }
    public static void ValidateLink(string value)
    {
        if (!value.StartsWith("#", StringComparison.Ordinal) && !(Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme is "https" or "http" or "mailto")) throw new InvalidDataException("Dieser Linktyp ist nicht erlaubt.");
    }
    public static bool IsStoryCard(JsonObject meta) => meta["storyCard"] is JsonObject card &&
        card["type"] is JsonValue value && value.TryGetValue<string>(out var type) && type is "figure" or "place" or "item";
    public static void ValidateMeta(JsonObject meta, string kind)
    {
        if (meta.ToJsonString().Length > 2_000_000) throw new InvalidDataException("Die Metadaten überschreiten 2 MB.");
        static bool Text(JsonNode? n) => n is JsonValue v && v.TryGetValue<string>(out _);
        if (meta.ContainsKey("storyCard"))
        {
            if (!IsStoryCard(meta) || kind != "text") throw new InvalidDataException("Ungültiger Kartentyp.");
            var card = meta["storyCard"]!.AsObject();
            if (card.Any(p => p.Key is not ("type" or "aliases" or "fields")) || card["aliases"] is not JsonArray aliases ||
                aliases.Any(n => !Text(n) || string.IsNullOrWhiteSpace(n!.GetValue<string>()) || n.GetValue<string>().Length > 500) ||
                aliases.Select(n => n!.GetValue<string>()).Distinct(StringComparer.Ordinal).Count() != aliases.Count || card["fields"] is not JsonObject fields)
                throw new InvalidDataException("Namen oder Felder der Karte sind ungültig.");
            string[] allowed = card["type"]!.GetValue<string>() switch
            {
                "figure" => ["role", "motivation", "conflict", "relationships", "development", "notes"],
                "place" => ["atmosphere", "features", "significance", "notes"],
                "item" => ["description", "features", "owner", "origin", "significance", "notes"],
                _ => throw new InvalidDataException("Ungültiger Kartentyp.")
            };
            if (fields.Any(p => !allowed.Contains(p.Key) || !Text(p.Value)) ||
                (meta.ContainsKey("custom") && (meta["custom"] is not JsonObject custom || custom.Any(p => string.IsNullOrWhiteSpace(p.Key) || p.Key.Length > 500 || !Text(p.Value)))))
                throw new InvalidDataException("Kartenfelder müssen benannte Textfelder sein.");
        }
        if (meta.ContainsKey("storyCardIds"))
        {
            if (kind is not ("text" or "script") || IsStoryCard(meta) || meta["storyCardIds"] is not JsonArray ids || ids.Any(n => !Text(n) || n!.GetValue<string>().Length != 32 || !n.GetValue<string>().All(Uri.IsHexDigit)) ||
                ids.Select(n => n!.GetValue<string>()).Distinct(StringComparer.Ordinal).Count() != ids.Count)
                throw new InvalidDataException("Ungültige Kartenverweise.");
        }
    }
}

public sealed record DocumentInfo
{
    public string Id { get; init; } = Model.Id();
    public string? ParentId { get; set; }
    public int Position { get; set; }
    public string Title { get; set; } = "Neuer Abschnitt";
    public string Kind { get; set; } = "text";
    public string? Body { get; set; }
    public JsonObject Meta { get; set; } = new();
    public long Revision { get; set; }
    public bool Deleted { get; set; }
    public int Words { get; set; }
    public string Modified { get; set; } = DateTimeOffset.UtcNow.ToString("O");
}
public sealed record ProjectInfo(string Id, string Title, JsonObject Settings, IReadOnlyList<DocumentInfo> Documents, bool ReadOnly, string FilePath);
public sealed record SnapshotInfo(string Id, string DocumentId, string Title, string Created, string Body, JsonObject Meta);
public sealed record AssetInfo(string Id, string Name, string Mime, long Size);
public sealed record ExportOptions(string Format, string Title, string Author, string[] DocumentIds, bool IncludeComments = false, bool IncludeTitles = true, string Paper = "a4", string Font = "Libertinus Serif", int FontSize = 11, string Separator = "* * *", bool TableOfContents = true, bool Endnotes = false);
public sealed class RevisionConflictException(string message) : Exception(message);
