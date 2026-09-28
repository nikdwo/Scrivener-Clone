using System.Text.Json.Nodes;
using Schreibatelier.Core;

static class TimelineChecks
{
    public static async Task Run(string root)
    {
        var count=0;
        void Check(bool ok,string label){if(!ok)throw new Exception("FAILED: "+label);Console.WriteLine("PASS "+label);count++;}
        void Reject(Action action,string label){try{action();}catch(InvalidDataException){Check(true,label);return;}throw new Exception("FAILED: "+label);}
        JsonObject Meta(string value)=>new(){["timeline"]=JsonNode.Parse(value)};
        var path=Path.Combine(root,"timeline.schreibprojekt");var strand=Model.Id();string firstId,expected;
        using(var store=ProjectStore.Create(path,"Zeitprüfung",Path.Combine(root,"timeline-backups")))
        {
            Check(!store.GetProject().Settings.ContainsKey("timeline"),"Timeline does not migrate old settings");
            Reject(()=>store.AddDocument("manuscript","Too soon",meta:Meta("{\"start\":{\"day\":1}}")),"Timeline requires project basis");
            var settings=new JsonObject{["timeline"]=new JsonObject{["basis"]="relative",["strands"]=new JsonArray(new JsonObject{["id"]=strand,["name"]="Haupthandlung"})}};
            store.SaveSettings("Zeitprüfung",settings);
            var meta=Meta("{\"start\":{\"day\":-1,\"time\":\"23:59\"},\"end\":{\"day\":1}}");meta["timeline"]!["strandId"]=strand;
            var first=store.AddDocument("manuscript","Erste Szene",body:Model.TextBody("Mara kommt.\nSie bleibt."),meta:meta);firstId=first.Id;expected=meta["timeline"]!.ToJsonString();
            var second=store.Split(first.Id,first.Revision,Model.TextBody("Mara kommt."),Model.TextBody("Sie bleibt."),"Zweite Szene");
            Check(second.Meta["timeline"]!.ToJsonString()==expected,"Split retains exact time span and strand");
            second.Meta["timeline"]!["start"]!["day"]=0;second=store.SaveDocuments([second]).Single();
            first=store.GetDocument(first.Id);first=store.Merge(first.Id,second.Id,first.Revision,second.Revision);
            Check(first.Meta["timeline"]!.ToJsonString()==expected&&store.GetSnapshot(second.Id,store.Snapshots(second.Id).Single().Id).Meta["timeline"]!["start"]!["day"]!.GetValue<int>()==0,"Merge keeps first timing and recoverable second timing");
            var copy=store.AddDocument("manuscript","Kopie",body:first.Body,meta:first.Meta.DeepClone().AsObject());
            Check(copy.Meta["timeline"]!.ToJsonString()==expected,"Duplicate keeps time span and strand");
            store.Trash(first.Id,true);store.Trash(first.Id,false);Check(store.GetDocument(first.Id).Meta["timeline"]!.ToJsonString()==expected,"Trash and restore retain timeline");
            var snapshot=store.Snapshot(first.Id,"Zeitstand");var changed=store.GetDocument(first.Id);changed.Meta.Remove("timeline");store.SaveDocuments([changed]);store.RestoreSnapshot(first.Id,snapshot);
            Check(store.GetDocument(first.Id).Meta["timeline"]!.ToJsonString()==expected,"Snapshot restores timing");
            var changedBasis=settings.DeepClone().AsObject();changedBasis["timeline"]!["basis"]="calendar";
            Reject(()=>store.SaveSettings("Bad",changedBasis),"Chosen basis cannot change");Reject(()=>store.SaveSettings("Bad",new()),"Chosen basis cannot be removed");
            var deleted=settings.DeepClone().AsObject();deleted["timeline"]!["strands"]=new JsonArray();
            Reject(()=>store.SaveSettings("Bad",deleted),"Assigned strand cannot be removed");
            foreach(var doc in store.GetProject().Documents.Where(d=>d.Meta["timeline"]?["strandId"]?.GetValue<string>()==strand&&!d.Deleted))store.Trash(doc.Id,true);
            Reject(()=>store.SaveSettings("Bad",deleted),"Trash assignments prevent strand deletion");store.Trash(first.Id,false);
            foreach(var bad in new[]{"null","{\"start\":null}","{\"end\":{\"day\":1}}","{\"start\":{\"day\":1},\"end\":{\"day\":0}}","{\"start\":{\"day\":1.5}}","{\"start\":{\"day\":1,\"time\":\"24:00\"}}","{\"start\":{\"day\":\"2024-02-30\"}}","{\"start\":{\"day\":\"2024-02-29\"}}","{\"strandId\":\"x\"}","{\"extra\":true}"})
                Reject(()=>store.AddDocument("manuscript","Ungültig",meta:Meta(bad)),"Invalid timeline rejected: "+bad);
            Reject(()=>store.AddDocument("manuscript","Ordner",kind:"folder",meta:meta),"Folder cannot carry timing");
            var stale=store.GetDocument(first.Id);store.SaveDocuments([stale]);
            try{store.SaveDocuments([stale]);throw new Exception("Stale save accepted");}catch(RevisionConflictException){Check(true,"Timeline edits retain revision checks");}
            var invalid=store.GetDocument(first.Id);invalid.Meta=Meta("{\"start\":{\"day\":1},\"end\":{\"day\":0}}");Reject(()=>store.SaveDocuments([invalid]),"Invalid document save preserves persisted timing");
            Reject(()=>store.ImportDocuments([new(){ParentId="manuscript",Meta=Meta("{\"start\":{\"day\":\"2024-01-01\"}}") }]),"Import enforces time basis");
            using(var reader=new ProjectStore(path))
            {
                Check(reader.ReadOnly&&reader.GetProject().Settings["timeline"]!.ToJsonString()==settings["timeline"]!.ToJsonString(),"Read-only timeline is available");
                try{reader.SaveSettings("Bad",settings);throw new Exception("Writable");}catch(IOException){Check(true,"Read-only timeline edits rejected");}
            }
            var output=Path.Combine(root,"timeline.txt");await new ConversionService().Export(store,new ExportOptions("txt","Test","",[first.Id]),output);
            Check(File.ReadAllText(output).Contains("Mara kommt.")&&!File.ReadAllText(output).Contains(strand),"Manuscript export contains no timeline data");
            var before=store.GetProject();Reject(()=>store.SaveSettings("Bad",new JsonObject{["timeline"]=new JsonObject{["basis"]="relative",["strands"]=new JsonArray(new JsonObject{["id"]=strand,["name"]=true})}}),"Invalid strand definitions rejected");
            Check(store.GetProject().Title==before.Title&&store.GetDocument(first.Id).Meta["timeline"]!.ToJsonString()==expected,"Rejected writes preserve title and timing");
        }
        using(var reopened=new ProjectStore(path))Check(reopened.GetDocument(firstId).Meta["timeline"]!.ToJsonString()==expected,"Timeline survives project restart");
        using(var orphan=ProjectStore.Create(Path.Combine(root,"orphan.schreibprojekt"),"Entfernte Handlung",Path.Combine(root,"orphan-backups")))
        {
            var settings=new JsonObject{["timeline"]=new JsonObject{["basis"]="relative",["strands"]=new JsonArray(new JsonObject{["id"]=strand,["name"]="Vorher"})}};
            orphan.SaveSettings("Entfernte Handlung",settings);var doc=orphan.AddDocument("manuscript","Szene",meta:Meta("{\"strandId\":\""+strand+"\"}"));var snapshot=orphan.Snapshot(doc.Id,"Zuordnung");
            doc.Meta.Remove("timeline");orphan.SaveDocuments([doc]);settings["timeline"]!["strands"]=new JsonArray();orphan.SaveSettings("Entfernte Handlung",settings);
            orphan.RestoreSnapshot(doc.Id,snapshot);Check(orphan.GetDocument(doc.Id).Meta["timeline"]!["strandId"]!.GetValue<string>()==strand,"Restored snapshots retain missing strand references for reassignment");
        }
        using(var calendar=ProjectStore.Create(Path.Combine(root,"calendar.schreibprojekt"),"Kalender",Path.Combine(root,"calendar-backups")))
        {
            calendar.SaveSettings("Kalender",new JsonObject{["timeline"]=new JsonObject{["basis"]="calendar",["strands"]=new JsonArray()}});
            var leap=calendar.AddDocument("manuscript","Schalttag",meta:Meta("{\"start\":{\"day\":\"2024-02-29\",\"time\":\"23:59\"},\"end\":{\"day\":\"2024-03-01\",\"time\":\"00:00\"}}"));
            Check(leap.Meta["timeline"]!["start"]!["day"]!.GetValue<string>()=="2024-02-29","Calendar leap day and midnight stored without timezone conversion");
            Reject(()=>calendar.AddDocument("manuscript","Falsch",meta:Meta("{\"start\":{\"day\":1}}")),"Calendar project rejects relative timing");
        }
        Console.WriteLine($"{count} timeline checks passed.");
    }
}
