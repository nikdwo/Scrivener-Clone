using System.Text.Json.Nodes;
using Schreibatelier.Core;

static class RelationshipChecks
{
    public static void Run(string root)
    {
        var count=0;
        void Check(bool ok,string label){if(!ok)throw new Exception("FAILED: "+label);Console.WriteLine("PASS "+label);count++;}
        void Reject(Action action,string label){try{action();}catch(InvalidDataException){Check(true,label);return;}throw new Exception("FAILED: "+label);}
        JsonObject Card(string type)=>new(){["storyCard"]=new JsonObject{["type"]=type,["aliases"]=new JsonArray(),["fields"]=new JsonObject{["notes"]="Originalnotiz"}}};
        JsonObject Edge(string from,string to,string label="kennt",string direction="directed")=>new(){["id"]=Model.Id(),["fromId"]=from,["toId"]=to,["label"]=label,["direction"]=direction,["notes"]="Notiz"};
        var path=Path.Combine(root,"relationships.schreibprojekt");string figure,place,item,expected,backup;
        using(var store=ProjectStore.Create(path,"Netzprüfung",Path.Combine(root,"relationship-backups")))
        {
            Check(!store.GetProject().Settings.ContainsKey("relationshipNetwork"),"Old projects have no implicit relationship settings");
            var f=store.AddDocument("research","Mara",meta:Card("figure"));figure=f.Id;
            place=store.AddDocument("research","Hafenstadt",meta:Card("place")).Id;item=store.AddDocument("research","Kompass",meta:Card("item")).Id;
            var scene=store.AddDocument("manuscript","Szene",body:Model.TextBody("Mara liest."));var body=scene.Body;
            var net=new JsonObject{["edges"]=new JsonArray(Edge(figure,place,"wohnt in"),Edge(figure,item,"besitzt"),Edge(item,place,"verbunden","mutual")),["positions"]=new JsonObject{[figure]=new JsonObject{["x"]=80,["y"]=120}}};
            var settings=new JsonObject{["relationshipNetwork"]=net};store.SaveSettings("Netzprüfung",settings);
            Check(JsonNode.DeepEquals(store.GetProject().Settings,settings),"All card types, directions, notes and positions persist");
            Check(store.GetDocument(scene.Id).Body==body,"Relationships leave manuscript text unchanged");
            var output=Path.Combine(root,"relationships.txt");new ConversionService().Export(store,new ExportOptions("txt","Test","",[scene.Id]),output).GetAwaiter().GetResult();Check(File.ReadAllText(output).Contains("Mara liest.")&&!File.ReadAllText(output).Contains("wohnt in"),"Export contains manuscript text without network relationships");
            void Invalid(Action<JsonObject> mutate,string label){var copy=(JsonObject)settings.DeepClone();mutate(copy["relationshipNetwork"]!.AsObject());Reject(()=>store.SaveSettings("Netzprüfung",copy),label);}
            Invalid(n=>n["edges"]![0]!["toId"]=figure,"Self links rejected");
            Invalid(n=>n["edges"]![0]!["toId"]=scene.Id,"Non-card endpoints rejected");
            Invalid(n=>n["edges"]![0]!["toId"]=Model.Id(),"Unknown endpoints rejected");
            Invalid(n=>n["edges"]![0]!["id"]="invalid","Malformed IDs rejected");
            Invalid(n=>n["edges"]![0]!["direction"]="both","Invalid directions rejected");
            Invalid(n=>n["edges"]![0]!["label"]=" ","Empty relationship labels rejected");
            Invalid(n=>n["edges"]![0]!["label"]=new string('x',201),"Overlong relationship labels rejected");
            Invalid(n=>n["edges"]![0]!["notes"]=false,"Non-text notes rejected");
            Invalid(n=>n["edges"]!.AsArray().Add(Edge(figure,place,"wohnt in")),"Duplicate directed links rejected");
            Invalid(n=>n["edges"]!.AsArray().Add(Edge(place,item,"verbunden","mutual")),"Reversed duplicate mutual links rejected");
            Invalid(n=>n["positions"]![figure]!["x"]=-1,"Negative positions rejected");
            Invalid(n=>n["positions"]![figure]!["x"]=1_000_001,"Excessive coordinates rejected");
            Invalid(n=>n["positions"]![figure]!["x"]="12","Non-numeric coordinates rejected");
            Invalid(n=>n["edges"]![0]!["notes"]=new string('x',2_000_001),"Existing settings size limit enforced");
            Check(JsonNode.DeepEquals(store.GetProject().Settings,settings),"Failed writes retain prior relationships");
            store.Trash(place,true);store.SaveSettings("Netzprüfung",settings);
            Check(JsonNode.DeepEquals(store.GetProject().Settings,settings),"Trash retains unchanged relationship references");
            Invalid(n=>n["edges"]!.AsArray().Add(Edge(item,place,"liegt in")),"New links to trashed cards rejected");
            store.Trash(place,false);Check(!store.GetDocument(place).Deleted,"Restore makes card available under its original ID");
            var snapshot=store.Snapshot(figure,"Vorher");f=store.GetDocument(figure);f.Title="Mara Neu";store.SaveDocuments([f]);store.RestoreSnapshot(figure,snapshot);
            Check(JsonNode.DeepEquals(store.GetProject().Settings,settings),"Card snapshots do not rewind central relationships");
            var original=store.GetDocument(figure);var duplicate=store.AddDocument(original.ParentId!,original.Title+" Kopie",original.Kind,original.Body,(JsonObject)original.Meta.DeepClone());Check(!net["positions"]!.AsObject().ContainsKey(duplicate.Id)&&!net["edges"]!.AsArray().Any(e=>e!["fromId"]!.GetValue<string>()==duplicate.Id||e["toId"]!.GetValue<string>()==duplicate.Id),"Duplicate card starts without network links or position");
            var baseline=(JsonObject)settings.DeepClone();var a=(JsonObject)settings.DeepClone();a["wordTarget"]=1234;store.SaveSettings("Netzprüfung",a,baseline);
            var b=(JsonObject)baseline.DeepClone();b["relationshipNetwork"]!["positions"]![figure]!["x"]=240;store.SaveSettings("Netzprüfung",b,baseline);
            Check(store.GetProject().Settings["wordTarget"]!.GetValue<int>()==1234,"Concurrent unrelated settings blocks are preserved");
            var latest=store.GetProject().Settings;store.SaveSettings("Neuer Projekttitel",latest);store.SaveSettings("Netzprüfung",latest,latest,"Netzprüfung");Check(store.GetProject().Title=="Neuer Projekttitel","Unchanged stale title does not overwrite concurrent project rename");
            try{b["relationshipNetwork"]!["positions"]![figure]!["x"]=360;store.SaveSettings("Netzprüfung",b,baseline);throw new Exception("Missing conflict");}catch(RevisionConflictException){Check(true,"Concurrent writes to the same settings block report conflict");}
            using(var reader=new ProjectStore(path)){Check(reader.ReadOnly,"Second instance opens read-only");Check(reader.GetProject().Settings.ContainsKey("relationshipNetwork"),"Read-only instance can read the network");try{reader.SaveSettings("Netzprüfung",settings);throw new Exception("Missing read-only rejection");}catch(IOException){Check(true,"Read-only instance rejects network changes");}}
            expected=store.GetProject().Settings.ToJsonString();backup=store.Backup();store.SaveCopy(Path.Combine(root,"relationship-copy.schreibprojekt"));
        }
        using(var reopened=new ProjectStore(path))Check(reopened.GetProject().Settings.ToJsonString()==expected,"Network and positions survive reopening");
        using(var copy=new ProjectStore(Path.Combine(root,"relationship-copy.schreibprojekt")))Check(copy.GetProject().Settings.ToJsonString()==expected,"Project copy includes the network");
        using(var copy=new ProjectStore(backup))Check(copy.GetProject().Settings.ToJsonString()==expected,"Backup includes the network");
        Console.WriteLine($"{count} relationship checks passed.");
    }
}
