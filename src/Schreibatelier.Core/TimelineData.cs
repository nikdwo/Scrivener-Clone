using System.Globalization;
using System.Text.Json.Nodes;

namespace Schreibatelier.Core;

public static class TimelineData
{
    private static bool Text(JsonNode? n, out string text) { text = ""; return n is JsonValue v && v.TryGetValue(out text!); }
    private static bool Id(JsonNode? n) => Text(n, out var id) && id.Length == 32 && id.All(Uri.IsHexDigit);
    public static void ValidateSettings(JsonObject settings)
    {
        if (!settings.ContainsKey("timeline")) return;
        if (settings["timeline"] is not JsonObject t || t.Any(p => p.Key is not ("basis" or "strands")) ||
            !Text(t["basis"], out var basis) || basis is not ("relative" or "calendar") || t["strands"] is not JsonArray strands)
            throw new InvalidDataException("Ungültige Zeitstrahleinstellungen.");
        var ids = new HashSet<string>();
        foreach (var n in strands)
            if (n is not JsonObject s || s.Any(p => p.Key is not ("id" or "name")) || !Id(s["id"]) || !ids.Add(s["id"]!.GetValue<string>()) ||
                !Text(s["name"], out var name) || string.IsNullOrWhiteSpace(name) || name.Length > 200)
                throw new InvalidDataException("Handlungsstränge benötigen eindeutige IDs und Namen mit höchstens 200 Zeichen.");
    }
    private static (long Low, long High, string Basis) Point(JsonNode? n)
    {
        if (n is not JsonObject p || p.Any(x => x.Key is not ("day" or "time"))) throw new InvalidDataException("Ungültige Zeitangabe.");
        long day; string basis;
        if (p["day"] is JsonValue v && v.TryGetValue<int>(out var relative)) { day = relative; basis = "relative"; }
        else if (Text(p["day"], out var date) && DateOnly.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
        { day = parsed.DayNumber; basis = "calendar"; }
        else throw new InvalidDataException("Bitte einen ganzen relativen Tag oder ein gültiges Kalenderdatum angeben.");
        var low = day * 1440;
        if (!p.ContainsKey("time")) return (low, low + 1439, basis);
        if (!Text(p["time"], out var time) || !TimeOnly.TryParseExact(time, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var clock))
            throw new InvalidDataException("Bitte eine Uhrzeit zwischen 00:00 und 23:59 angeben.");
        low += clock.Hour * 60 + clock.Minute; return (low, low, basis);
    }
    public static void ValidateMeta(JsonObject meta, string kind)
    {
        if (!meta.ContainsKey("timeline")) return;
        if (kind is not ("text" or "script") || Model.IsStoryCard(meta) || meta["timeline"] is not JsonObject t || t.Any(p => p.Key is not ("start" or "end" or "strandId")))
            throw new InvalidDataException("Zeitangaben sind nur für Text- und Drehbuchabschnitte vorgesehen.");
        if (t.ContainsKey("strandId") && !Id(t["strandId"])) throw new InvalidDataException("Ungültiger Handlungsstrangverweis.");
        if (t.ContainsKey("end") && !t.ContainsKey("start")) throw new InvalidDataException("Ein Ende benötigt einen Beginn.");
        if (!t.ContainsKey("start")) return;
        var start = Point(t["start"]);
        if (t.ContainsKey("end"))
        {
            var end = Point(t["end"]);
            if (start.Basis != end.Basis || end.High < start.Low) throw new InvalidDataException("Das Ende darf nicht vor dem Beginn liegen und muss dieselbe Zeitbasis verwenden.");
        }
    }
    public static void ValidateBasis(JsonObject meta, JsonObject settings)
    {
        if (meta["timeline"] is not JsonObject t) return;
        if (settings["timeline"] is not JsonObject config) throw new InvalidDataException("Bitte zuerst die Zeitbasis des Projekts einrichten.");
        if (t.ContainsKey("start") && Point(t["start"]).Basis != config["basis"]!.GetValue<string>()) throw new InvalidDataException("Die Zeitangabe passt nicht zur Zeitbasis des Projekts.");
    }
}
