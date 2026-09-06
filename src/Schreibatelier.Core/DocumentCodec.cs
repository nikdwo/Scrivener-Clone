using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Schreibatelier.Core;

// Our adapter between the documented editor tree and Pandoc's public JSON AST.
// No HTML or executable raw blocks are accepted at this boundary.
public static class DocumentCodec
{
    public static string WithoutCardLinks(string body, ISet<string> cardIds)
    {
        if (cardIds.Count == 0) return body;
        var root = JsonNode.Parse(body)!;
        void Walk(JsonNode node)
        {
            if (node["marks"] is JsonArray marks)
                for (var i = marks.Count - 1; i >= 0; i--)
                    if (marks[i]?["type"]?.GetValue<string>() == "link" && marks[i]?["attrs"]?["href"]?.GetValue<string>() is string href && href.StartsWith('#') && cardIds.Contains(href[1..])) marks.RemoveAt(i);
            if (node["content"] is JsonArray children) foreach (var child in children) if (child is not null) Walk(child);
        }
        Walk(root); return root.ToJsonString();
    }
    private static JsonObject P(string type, JsonNode? value = null) => value is null ? new() { ["t"] = type } : new() { ["t"] = type, ["c"] = value };
    private static JsonArray Attr(string? style = null) => new("", new JsonArray(), style is null ? new JsonArray() : new JsonArray(new JsonArray("custom-style", style)));
    private static JsonObject Node(string type, JsonArray? content = null, JsonObject? attrs = null) { var n = new JsonObject { ["type"] = type }; if (content is not null) n["content"] = content; if (attrs is not null) n["attrs"] = attrs; return n; }
    private static JsonArray ArrayOf(IEnumerable<JsonNode?> values) => new(values.ToArray());
    private static string S(JsonNode? n) => n?.GetValue<string>() ?? "";
    private static JsonArray Children(JsonNode n) => n["content"]?.AsArray() ?? new();

    public static JsonArray ToBlocks(string body, Func<string, string> assetPath, bool comments = false)
    {
        var root = JsonNode.Parse(body)!; var result = new JsonArray();
        foreach (var n in Children(root)) if (n is not null) result.Add(ToBlock(n, assetPath, comments));
        return result;
    }
    private static JsonObject ToBlock(JsonNode n, Func<string, string> assets, bool comments)
    {
        var content = Children(n); var attrs = n["attrs"];
        JsonArray Blocks() => ArrayOf(content.Where(x => x is not null).Select(x => (JsonNode)ToBlock(x!, assets, comments)));
        switch (S(n["type"]))
        {
            case "heading": return P("Header", new JsonArray(attrs?["level"]?.GetValue<int>() ?? 1, Attr(), ToInlines(content, assets, comments)));
            case "blockquote": return P("BlockQuote", Blocks());
            case "horizontalRule": return P("HorizontalRule");
            case "codeBlock": return P("CodeBlock", new JsonArray(Attr(), string.Concat(content.Select(x => S(x?["text"])))));
            case "bulletList": return P("BulletList", ArrayOf(content.Select(x => (JsonNode)ArrayOf(Children(x!).Select(c => (JsonNode)ToBlock(c!, assets, comments))))));
            case "orderedList": return P("OrderedList", new JsonArray(new JsonArray(attrs?["start"]?.GetValue<int>() ?? 1, P("Decimal"), P("Period")), ArrayOf(content.Select(x => (JsonNode)ArrayOf(Children(x!).Select(c => (JsonNode)ToBlock(c!, assets, comments)))))));
            case "image": return P("Para", ToInlines(new JsonArray(n.DeepClone()), assets, comments));
            case "table":
                JsonArray Row(JsonNode row) => new(Attr(), ArrayOf(Children(row).Select(cell => (JsonNode)new JsonArray(Attr(), P("AlignDefault"), cell?["attrs"]?["rowspan"]?.GetValue<int>() ?? 1, cell?["attrs"]?["colspan"]?.GetValue<int>() ?? 1, ArrayOf(Children(cell!).Select(b => (JsonNode)ToBlock(b!, assets, comments)))))));
                var columns = content.Count == 0 ? 1 : Children(content[0]!).Sum(c => c?["attrs"]?["colspan"]?.GetValue<int>() ?? 1);
                return P("Table", new JsonArray(Attr(), new JsonArray(null, new JsonArray()), ArrayOf(Enumerable.Range(0, columns).Select(_ => (JsonNode)new JsonArray(P("AlignDefault"), P("ColWidthDefault")))), new JsonArray(Attr(), new JsonArray()), new JsonArray(new JsonArray(Attr(), 0, new JsonArray(), ArrayOf(content.Select(r => (JsonNode)Row(r!))))), new JsonArray(Attr(), new JsonArray())));
            default: return P("Para", ToInlines(content, assets, comments));
        }
    }
    private static JsonArray ToInlines(JsonArray content, Func<string, string> assets, bool comments)
    {
        var result = new JsonArray();
        foreach (var n in content)
        {
            if (n is null) continue;
            var type = S(n["type"]); var a = n["attrs"];
            if (type == "hardBreak") { result.Add(P("LineBreak")); continue; }
            if (type == "image") { result.Add(P("Image", new JsonArray(Attr(), new JsonArray(P("Str", JsonValue.Create(S(a?["alt"])))), new JsonArray(assets(S(a?["src"]).Split('/').Last()), S(a?["title"]))))); continue; }
            if (type == "footnote") { result.Add(P("Note", new JsonArray(P("Para", ToInlines(new JsonArray(new JsonObject { ["type"] = "text", ["text"] = S(a?["text"]) }), assets, false))))); continue; }
            if (type != "text") continue;
            JsonArray current = new();
            foreach (var token in Regex.Split(S(n["text"]), "(\\s+)").Where(t => t.Length > 0)) current.Add(char.IsWhiteSpace(token[0]) ? P("Space") : P("Str", JsonValue.Create(token)));
            foreach (var mark in n["marks"]?.AsArray() ?? new())
            {
                var m = S(mark?["type"]); var ma = mark?["attrs"];
                var wrapper = m switch { "bold" => "Strong", "italic" => "Emph", "strike" => "Strikeout", "underline" => "Underline", "superscript" => "Superscript", "subscript" => "Subscript", _ => null };
                if (wrapper is not null) current = new(P(wrapper, current));
                else if (m == "code") current = new(P("Code", new JsonArray(Attr(), S(n["text"]))));
                else if (m == "link") current = new(P("Link", new JsonArray(Attr(), current, new JsonArray(S(ma?["href"]), ""))));
                else if (m == "comment" && comments) current.Add(P("Note", new JsonArray(P("Para", new JsonArray(P("Str", JsonValue.Create("Kommentar: " + S(ma?["text"]))))))));
            }
            foreach (var inline in current) result.Add(inline?.DeepClone());
        }
        return result;
    }

    public static string FromPandoc(JsonObject ast, Func<string, string?> importImage, List<string> warnings)
    {
        var blocks = new JsonArray(); foreach (var b in ast["blocks"]!.AsArray()) AddBlock(b!, blocks, importImage, warnings);
        if (blocks.Count == 0) blocks.Add(Node("paragraph"));
        return Node("doc", blocks).ToJsonString();
    }
    private static void AddBlock(JsonNode n, JsonArray output, Func<string, string?> image, List<string> warnings)
    {
        var t = S(n["t"]); var c = n["c"];
        JsonArray BlockList(JsonArray source) { var list = new JsonArray(); foreach (var child in source) AddBlock(child!, list, image, warnings); return list; }
        switch (t)
        {
            case "Para": case "Plain":
                var inlines = FromInlines(c!.AsArray(), image, warnings);
                // Block images must not be nested in paragraphs in our editor schema.
                var run = new JsonArray();
                foreach (var i in inlines)
                    if (S(i?["type"]) == "image") { if (run.Count > 0) { output.Add(Node("paragraph", run)); run = new(); } output.Add(i!.DeepClone()); }
                    else run.Add(i!.DeepClone());
                if (run.Count > 0 || inlines.Count == 0) output.Add(Node("paragraph", run));
                break;
            case "Header": output.Add(Node("heading", FromInlines(c![2]!.AsArray(), image, warnings), new() { ["level"] = Math.Clamp(c[0]!.GetValue<int>(), 1, 6) })); break;
            case "BlockQuote": output.Add(Node("blockquote", BlockList(c!.AsArray()))); break;
            case "HorizontalRule": output.Add(Node("horizontalRule")); break;
            case "CodeBlock": output.Add(Node("codeBlock", new JsonArray(new JsonObject { ["type"] = "text", ["text"] = S(c![1]) }))); break;
            case "BulletList": case "OrderedList":
                var items = new JsonArray(); foreach (var item in (t == "BulletList" ? c! : c![1]!).AsArray()) items.Add(Node("listItem", BlockList(item!.AsArray())));
                output.Add(Node(t == "BulletList" ? "bulletList" : "orderedList", items, t == "OrderedList" ? new() { ["start"] = c![0]![0]!.GetValue<int>() } : null)); break;
            case "Div": foreach (var child in c![1]!.AsArray()) AddBlock(child!, output, image, warnings); break;
            case "Table":
                var rows = new JsonArray();
                void Rows(JsonArray source, bool header) { foreach (var row in source) { var cells = new JsonArray(); foreach (var cell in row![1]!.AsArray()) cells.Add(Node(header ? "tableHeader" : "tableCell", BlockList(cell![4]!.AsArray()), new() { ["rowspan"] = cell[2]!.GetValue<int>(), ["colspan"] = cell[3]!.GetValue<int>() })); rows.Add(Node("tableRow", cells)); } }
                Rows(c![3]![1]!.AsArray(), true); foreach (var b in c[4]!.AsArray()) { Rows(b![2]!.AsArray(), true); Rows(b[3]!.AsArray(), false); } Rows(c[5]![1]!.AsArray(), false);
                if (rows.Count > 0) output.Add(Node("table", rows)); break;
            default: warnings.Add("Nicht übernommenes Blockelement: " + t); break;
        }
    }
    private static JsonArray FromInlines(JsonArray source, Func<string, string?> image, List<string> warnings)
    {
        var result = new JsonArray();
        foreach (var n in source)
        {
            var t = S(n?["t"]); var c = n?["c"];
            if (t is "Str" or "Space" or "SoftBreak" or "Code" or "Math")
            {
                var text = t == "Str" ? S(c) : t is "Code" or "Math" ? S(c?[1]) : " ";
                if (text.Length > 0) { var v = new JsonObject { ["type"] = "text", ["text"] = text }; if (t == "Code") v["marks"] = new JsonArray(new JsonObject { ["type"] = "code" }); result.Add(v); }
            }
            else if (t == "LineBreak") result.Add(Node("hardBreak"));
            else if (t == "Note")
            {
                var blocks = new JsonObject { ["blocks"] = c!.DeepClone() }; var body = FromPandoc(blocks, image, warnings);
                result.Add(Node("footnote", null, new() { ["id"] = Model.Id(), ["text"] = Model.PlainText(body) }));
            }
            else if (t == "Image") { var src = image(S(c![2]![0])); if (src is not null) result.Add(Node("image", null, new() { ["src"] = src, ["alt"] = string.Concat(c[1]!.AsArray().Select(x => S(x?["c"]))) })); else warnings.Add("Bild konnte nicht sicher übernommen werden: " + S(c[2]![0])); }
            else if (t is "Strong" or "Emph" or "Strikeout" or "Underline" or "Superscript" or "Subscript" or "Span" or "Link" or "Quoted" or "SmallCaps" or "Cite")
            {
                var inner = t is "Link" or "Span" or "Quoted" or "Cite" ? c![1]!.AsArray() : c!.AsArray(); var children = FromInlines(inner, image, warnings);
                var markType = t switch { "Strong" => "bold", "Emph" => "italic", "Strikeout" => "strike", "Underline" => "underline", "Superscript" => "superscript", "Subscript" => "subscript", "Link" => "link", _ => null };
                foreach (var child in children)
                {
                    var clone = child!.DeepClone();
                    if (markType is not null && S(clone["type"]) == "text")
                    {
                        var mark = new JsonObject { ["type"] = markType };
                        var valid = true;
                        if (markType == "link") { var href = S(c![2]![0]); try { Model.ValidateLink(href); mark["attrs"] = new JsonObject { ["href"] = href }; } catch (InvalidDataException) { valid = false; warnings.Add("Unsicherer Link entfernt."); } }
                        if (valid) { if (clone["marks"] is not JsonArray) clone["marks"] = new JsonArray(); clone["marks"]!.AsArray().Add(mark); }
                    }
                    result.Add(clone);
                }
            }
            else warnings.Add("Nicht übernommenes Inline-Element: " + t);
        }
        return result;
    }
}
