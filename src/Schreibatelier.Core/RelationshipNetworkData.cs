using System.Text.Json.Nodes;

namespace Schreibatelier.Core;

public static class RelationshipNetworkData
{
    private static bool Text(JsonNode? n, out string s) { s="";return n is JsonValue v && v.TryGetValue(out s!); }
    private static bool Id(string s) => s.Length==32 && s.All(c=>c is >= '0' and <= '9' or >= 'a' and <= 'f');
    private static bool Coordinate(JsonNode? n) => n is JsonValue && double.TryParse(n.ToJsonString(),System.Globalization.NumberStyles.Float,System.Globalization.CultureInfo.InvariantCulture,out var d) && double.IsFinite(d) && d>=0 && d<=1_000_000;
    public static void ValidateSettings(JsonObject settings)
    {
        if(!settings.ContainsKey("relationshipNetwork"))return;
        if(settings["relationshipNetwork"] is not JsonObject network || network.Any(p=>p.Key is not ("edges" or "positions")) || network["edges"] is not JsonArray edges || network["positions"] is not JsonObject positions)
            throw new InvalidDataException("Ungültiges Beziehungsnetz.");
        var ids=new HashSet<string>();var keys=new HashSet<string>();
        foreach(var node in edges)
        {
            if(node is not JsonObject e || e.Any(p=>p.Key is not ("id" or "fromId" or "toId" or "label" or "direction" or "notes")) ||
                !Text(e["id"],out var id)||!Id(id)||!ids.Add(id)||!Text(e["fromId"],out var from)||!Id(from)||!Text(e["toId"],out var to)||!Id(to)||from==to||
                !Text(e["label"],out var label)||string.IsNullOrWhiteSpace(label)||label.Trim().Length>200||!Text(e["notes"],out _)||!Text(e["direction"],out var direction)||direction is not ("directed" or "mutual"))
                throw new InvalidDataException("Beziehungen benötigen zwei unterschiedliche Karten, eine eindeutige ID und eine Bezeichnung mit höchstens 200 Zeichen.");
            if(direction=="mutual"&&string.CompareOrdinal(from,to)>0)(from,to)=(to,from);
            if(!keys.Add(System.Text.Json.JsonSerializer.Serialize(new[]{from,to,direction,label.Trim()})))throw new InvalidDataException("Diese Beziehung besteht bereits.");
        }
        foreach(var pair in positions)
            if(!Id(pair.Key)||pair.Value is not JsonObject p||p.Count!=2||!Coordinate(p["x"])||!Coordinate(p["y"]))throw new InvalidDataException("Ungültige Kartenposition im Beziehungsnetz (0 bis 1.000.000).");
    }
    public static void ValidateTargets(JsonObject previous,JsonObject settings,HashSet<string> available)
    {
        if(settings["relationshipNetwork"] is not JsonObject network)return;
        var old=previous["relationshipNetwork"] as JsonObject;
        var edges=(old?["edges"] as JsonArray??new()).ToDictionary(e=>e!["id"]!.GetValue<string>());
        foreach(var e in network["edges"]!.AsArray())
        {
            edges.TryGetValue(e!["id"]!.GetValue<string>(),out var before);
            foreach(var field in new[]{"fromId","toId"})if(!JsonNode.DeepEquals(before?[field],e[field])&&!available.Contains(e[field]!.GetValue<string>()))
                throw new InvalidDataException("Eine ausgewählte Karte ist nicht verfügbar.");
        }
        foreach(var p in network["positions"]!.AsObject())if(!JsonNode.DeepEquals(old?["positions"]?[p.Key],p.Value)&&!available.Contains(p.Key))throw new InvalidDataException("Die verschobene Karte ist nicht verfügbar.");
    }
    // Merge only blocks changed by this request; concurrent changes to the same block fail visibly.
    public static JsonObject MergeSettings(JsonObject current,JsonObject desired,JsonObject baseline)
    {
        var result=(JsonObject)current.DeepClone();
        foreach(var key in desired.Select(p=>p.Key).Union(baseline.Select(p=>p.Key)))
        {
            if(JsonNode.DeepEquals(desired[key],baseline[key])&&desired.ContainsKey(key)==baseline.ContainsKey(key))continue;
            if(!JsonNode.DeepEquals(current[key],baseline[key])&&!JsonNode.DeepEquals(current[key],desired[key]))throw new RevisionConflictException("Diese Projekteinstellung wurde zwischenzeitlich geändert. Bitte erneut speichern.");
            if(desired.ContainsKey(key))result[key]=desired[key]?.DeepClone();else result.Remove(key);
        }
        return result;
    }
}
