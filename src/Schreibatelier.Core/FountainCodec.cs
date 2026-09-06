using System.Text.Json.Nodes;

namespace Schreibatelier.Core;

// Original, line-preserving editor for the public Fountain syntax.
// ponytail: source syntax stays visible; simultaneous dialogue is preserved, not laid out as two columns.
public static class FountainCodec
{
    public static string Read(string source)
    {
        var blocks = new JsonArray(); bool dialogue = false, boneyard = false;
        foreach (var line in source.Replace("\r", "").Split('\n'))
        {
            var text = line; var trim = text.Trim(); var kind = "action";
            if (trim.Length == 0) dialogue = false;
            if (boneyard || trim.StartsWith("/*", StringComparison.Ordinal)) { kind = "note"; boneyard = !trim.Contains("*/", StringComparison.Ordinal); dialogue = false; }
            else if (trim.StartsWith("[[", StringComparison.Ordinal)) kind = "note";
            else if (trim.StartsWith('#')) { kind = "section"; dialogue = false; }
            else if (trim.StartsWith("===", StringComparison.Ordinal)) { kind = "pageBreak"; dialogue = false; }
            else if (trim.StartsWith('=')) { kind = "synopsis"; dialogue = false; }
            else if (trim.StartsWith('~')) kind = "lyrics";
            else if (trim.StartsWith('!')) { kind = "action"; dialogue = false; }
            else if (trim.StartsWith('>') && trim.EndsWith('<')) { kind = "centered"; dialogue = false; }
            else if (trim.StartsWith("INT.", StringComparison.OrdinalIgnoreCase) || trim.StartsWith("EXT.", StringComparison.OrdinalIgnoreCase) || trim.StartsWith("INT/EXT.", StringComparison.OrdinalIgnoreCase) || trim.StartsWith("I/E.", StringComparison.OrdinalIgnoreCase) || trim.StartsWith("EST.", StringComparison.OrdinalIgnoreCase) || (trim.StartsWith('.') && !trim.StartsWith("..", StringComparison.Ordinal))) { kind = "scene"; dialogue = false; }
            else if (trim.StartsWith('>') || trim.EndsWith("TO:", StringComparison.Ordinal)) { kind = "transition"; dialogue = false; }
            else if (trim.StartsWith('(') && trim.EndsWith(')')) kind = "parenthetical";
            else if (trim.StartsWith('@') || (!dialogue && trim.Length < 50 && trim.Any(char.IsLetter) && trim == trim.ToUpperInvariant())) { kind = "character"; dialogue = true; }
            else if (dialogue) kind = "dialogue";
            blocks.Add(new JsonObject { ["type"] = "script", ["attrs"] = new JsonObject { ["element"] = kind }, ["content"] = text.Length == 0 ? new JsonArray() : new JsonArray(new JsonObject { ["type"] = "text", ["text"] = text }) });
        }
        return new JsonObject { ["type"] = "doc", ["content"] = blocks }.ToJsonString();
    }
    public static string Write(string body)
    {
        string Text(JsonNode? n) => n?["type"]?.GetValue<string>() == "footnote" ? "" : n?["type"]?.GetValue<string>() == "hardBreak" ? "\n" : (n?["text"]?.GetValue<string>() ?? "") + string.Concat(n?["content"]?.AsArray().Select(Text) ?? []);
        return string.Join("\n", JsonNode.Parse(body)?["content"]?.AsArray().Select(Text) ?? []);
    }
}
