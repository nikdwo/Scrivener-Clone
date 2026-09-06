using System.Text.Json.Nodes;
using Schreibatelier.Core;

static class StoryCardChecks
{
    public static async Task Run(string root)
    {
        var count = 0;
        void Check(bool ok, string name) { if (!ok) throw new Exception("FAILED: " + name); Console.WriteLine("PASS " + name); count++; }
        void Reject(Action action, string name) { try { action(); } catch (InvalidDataException) { Check(true, name); return; } throw new Exception("FAILED: " + name); }
        JsonObject Card(string type, string alias) => new() { ["storyCard"] = new JsonObject { ["type"] = type, ["aliases"] = new JsonArray(alias), ["fields"] = new JsonObject { ["notes"] = "Grüße aus der Recherche." } }, ["custom"] = new JsonObject { ["Augenfarbe"] = "Blau" } };
        string[] Ids(DocumentInfo d) => d.Meta["storyCardIds"]!.AsArray().Select(n => n!.GetValue<string>()).ToArray();
        var path = Path.Combine(root, "cards.schreibprojekt");
        string figureId, placeId, sceneId, itemId, itemSceneId, backup;
        using (var store = ProjectStore.Create(path, "Kartenprüfung", Path.Combine(root, "backups")))
        {
            var figure = store.AddDocument("research", "Mara", meta: Card("figure", "Heimkehrerin")); figureId = figure.Id;
            var place = store.AddDocument("research", "Haus am See", meta: Card("place", "Seehaus")); placeId = place.Id;
            var first = store.AddDocument("manuscript", "Erste Szene", body: Model.TextBody("Mara kommt."), meta: new JsonObject { ["storyCardIds"] = new JsonArray(figureId) }); sceneId = first.Id;
            Check(store.GetProject().Documents.Count(d => Model.IsStoryCard(d.Meta)) == 2, "Cards use existing project documents");
            var second = store.Split(first.Id, first.Revision, Model.TextBody("Mara"), Model.TextBody("kommt."), "Zweite Szene");
            Check(Ids(second).SequenceEqual([figureId]), "Splitting preserves scene assignments");
            second.Meta["storyCardIds"] = new JsonArray(figureId, placeId); second = store.SaveDocuments([second]).Single();
            first = store.GetDocument(first.Id); first = store.Merge(first.Id, second.Id, first.Revision, second.Revision);
            Check(Ids(first).SequenceEqual([figureId, placeId]), "Merging unions assignments without duplicates");
            var copy = store.AddDocument("manuscript", "Kopie", body:first.Body, meta:first.Meta.DeepClone().AsObject());
            Check(Ids(copy).SequenceEqual(Ids(first)), "Duplicated scenes retain assignments");
            figure.Title = "Mara Berg"; figure = store.SaveDocuments([figure]).Single();
            Check(Ids(store.GetDocument(sceneId)).Contains(figureId), "Renaming keeps stable references");
            store.Trash(figureId, true); Check(Ids(store.GetDocument(sceneId)).Contains(figureId), "Trash preserves references");
            store.Trash(figureId, false); Check(!store.GetDocument(figureId).Deleted, "Restored cards keep their ID");
            var linked = JsonNode.Parse(Model.TextBody("Mara Berg"))!;
            linked["content"]![0]!["content"]![0]!["marks"] = new JsonArray(new JsonObject { ["type"] = "bold" }, new JsonObject { ["type"] = "link", ["attrs"] = new JsonObject { ["href"] = "#" + figureId } });
            first = store.GetDocument(sceneId); first.Body = linked.ToJsonString(); first = store.SaveDocuments([first]).Single();
            var cleaned = DocumentCodec.WithoutCardLinks(first.Body!, new HashSet<string> { figureId });
            Check(!cleaned.Contains(figureId) && cleaned.Contains("bold") && Model.PlainText(cleaned) == "Mara Berg", "Export removes card links and preserves text and formatting");
            Check(DocumentCodec.WithoutCardLinks(first.Body!, new HashSet<string> { placeId }).Contains(figureId), "Ordinary internal links are preserved");
            var output = Path.Combine(root, "cards.txt");
            await new ConversionService().Export(store, new ExportOptions("txt", "Test", "", [sceneId]), output);
            Check(File.ReadAllText(output).Contains("Mara Berg") && store.GetDocument(sceneId).Body!.Contains(figureId), "Actual export leaves project links intact");
            var bad = Card("unknown", "Alias"); Reject(() => store.AddDocument("research", "Ungültig", meta:bad), "Unknown card type rejected");
            Reject(() => store.AddDocument("research", "Kein Kartenordner", kind:"folder", meta:Card("figure", "Alias")), "Cards must be text documents");
            bad = Card("figure", "Alias"); bad["storyCardIds"] = new JsonArray(placeId); Reject(() => store.AddDocument("research", "Keine Szene", meta:bad), "Cards cannot carry scene assignments");
            bad = Card("figure", "Alias"); bad["storyCard"]!["fields"]!["role"] = true; Reject(() => store.AddDocument("research", "Ungültig", meta:bad), "Non-text field rejected");
            bad = Card("figure", "Alias"); bad["storyCard"]!["aliases"] = new JsonArray("Alias", "Alias"); Reject(() => store.AddDocument("research", "Ungültig", meta:bad), "Duplicate aliases rejected");
            first.Meta["storyCardIds"] = new JsonArray("manuscript"); Reject(() => store.SaveDocuments([first]), "Invalid reference IDs rejected");
            Check(Ids(store.GetDocument(sceneId)).SequenceEqual([figureId, placeId]), "Rejected save leaves earlier assignments intact");
            Reject(() => store.SaveSettings("Test", new JsonObject { ["recognizeCardNames"] = "yes" }), "Invalid recognition flag rejected");
            using (var reader = new ProjectStore(path, Path.Combine(root, "backups")))
            {
                Check(reader.ReadOnly && Model.IsStoryCard(reader.GetDocument(figureId).Meta), "Read-only project can load cards");
                try { reader.SaveDocuments([reader.GetDocument(figureId)]); throw new Exception("Read-only write succeeded"); }
                catch (IOException) { Check(true, "Read-only project rejects card edits"); }
            }
            var item = store.AddDocument("research", "Silberschlüssel", meta: Card("item", "Hausschlüssel")); itemId = item.Id;
            foreach (var field in new[] { "description", "features", "owner", "origin", "significance", "notes" }) item.Meta["storyCard"]!["fields"]![field] = "Wert für " + field;
            item = store.SaveDocuments([item]).Single();
            Check(Model.IsStoryCard(item.Meta) && item.Meta["storyCard"]!["fields"]!.AsObject().Count == 6, "Item cards accept all item fields");
            var itemScene = store.AddDocument("manuscript", "Schlüsselszene", body:Model.TextBody("Silberschlüssel"), meta:new JsonObject { ["storyCardIds"] = new JsonArray(itemId) }); itemSceneId = itemScene.Id;
            var itemTail = store.Split(itemScene.Id, itemScene.Revision, Model.TextBody("Silber"), Model.TextBody("schlüssel"), "Schlüsselszene – Fortsetzung");
            Check(Ids(itemTail).SequenceEqual([itemId]), "Splitting preserves item assignments");
            itemScene = store.GetDocument(itemScene.Id); itemScene = store.Merge(itemScene.Id, itemTail.Id, itemScene.Revision, itemTail.Revision);
            Check(Ids(itemScene).SequenceEqual([itemId]), "Merging deduplicates item assignments");
            var itemBody = JsonNode.Parse(Model.TextBody("Silberschlüssel"))!;
            itemBody["content"]![0]!["content"]![0]!["marks"] = new JsonArray(new JsonObject { ["type"] = "link", ["attrs"] = new JsonObject { ["href"] = "#" + itemId } });
            itemScene.Body = itemBody.ToJsonString(); store.SaveDocuments([itemScene]);
            Check(!DocumentCodec.WithoutCardLinks(itemScene.Body!, new HashSet<string> { itemId }).Contains(itemId), "Item card links are removed for export");
            var itemOutput = Path.Combine(root, "item.txt"); await new ConversionService().Export(store, new ExportOptions("txt", "Test", "", [itemSceneId]), itemOutput);
            Check(File.ReadAllText(itemOutput).Contains("Silberschlüssel") && !File.ReadAllText(itemOutput).Contains(itemId) && store.GetDocument(itemSceneId).Body!.Contains(itemId), "Item text export keeps stored project links intact");
            store.Trash(itemId, true); Check(store.GetDocument(itemId).Deleted && Ids(store.GetDocument(itemSceneId)).Contains(itemId), "Trashed item keeps scene assignments");
            store.Trash(itemId, false); Check(!store.GetDocument(itemId).Deleted, "Item card restores with its ID");
            var badItem = Card("item", "Alias"); badItem["storyCard"]!["fields"]!["role"] = "Figurenfeld";
            Reject(() => store.AddDocument("research", "Ungültiger Gegenstand", meta:badItem), "Item card rejects fields belonging to another card type");
            badItem = Card("item", "Alias"); badItem["storyCardIds"] = new JsonArray(figureId);
            Reject(() => store.AddDocument("research", "Keine Szene", meta:badItem), "Item cards cannot carry scene assignments");
            backup = store.Backup();
        }
        using (var reopened = new ProjectStore(path, Path.Combine(root, "backups")))
        {
            var figure = reopened.GetDocument(figureId);
            Check(figure.Title == "Mara Berg" && figure.Meta["custom"]!["Augenfarbe"]!.GetValue<string>() == "Blau" && figure.Meta["storyCard"]!["aliases"]![0]!.GetValue<string>() == "Heimkehrerin", "Reopening preserves fields and aliases");
            Check(Ids(reopened.GetDocument(sceneId)).SequenceEqual([figureId, placeId]), "Reopening preserves assignments");
            var item = reopened.GetDocument(itemId);
            Check(item.Meta["storyCard"]!["aliases"]![0]!.GetValue<string>() == "Hausschlüssel" && item.Meta["storyCard"]!["fields"]!["owner"]!.GetValue<string>() == "Wert für owner" && Ids(reopened.GetDocument(itemSceneId)).SequenceEqual([itemId]), "Reopening preserves item fields aliases and scene assignments");
        }
        using (var restored = new ProjectStore(backup, Path.Combine(root, "backups")))
            Check(Ids(restored.GetDocument(sceneId)).SequenceEqual([figureId, placeId]), "Backup includes cards and assignments");
        Console.WriteLine($"{count} story card checks passed.");
    }
}
