# Lokale deutsche Stilanalyse – Testversion

Diese Erweiterung liegt auf `testing`; sie ist noch nicht Bestandteil der veröffentlichten Alpha-4-Downloads. Kein Konto, Netzwerk oder LanguageTool-Prozess wird für die Stilanalyse benötigt.

## Starten und verwenden

`scripts/build.ps1 -Testing` erzeugt die selbstständige Windows-Testversion unter `artifacts/Schreibatelier-testing-timeline/app/Schreibatelier.exe` und aktualisiert **Schreibatelier starten** im Projektordner. Die interne Versionskennung ist `0.1.0-alpha.4+testing.timeline`; das Fenster trägt den Zusatz **Testversion Zeitstrahl** (einschließlich Stilanalyse). Der Testbuild enthält weiterhin die lokale Sprachprüfung. Installer und GitHub-Release entstehen durch diesen Befehl nicht.

1. Einen Textabschnitt öffnen, rechts **Prüfen → Prüfverfahren → Stilanalyse · lokal** auswählen.
2. **Abschnitt analysieren** anklicken. Eine zuvor bewusst markierte Passage wird über **Markierung analysieren** ausgewertet. Bei **Mit Unterabschnitten** zählt nur der aktive Editor.
3. Die Kategorien **Wortwiederholungen**, **Satzlängen** und **Füllwörter & Floskeln** einzeln ein- oder ausschalten. Die Auswahl wird im Projekt gespeichert.
4. Eine Fundstelle anklicken oder per Tab und Eingabetaste auswählen, um direkt zum Text zu springen. Der Prüfumfang bleibt dabei erhalten. **Ignorieren** blendet den Hinweis für diesen Analysestand aus; beim nächsten Lauf wird erneut ausgewertet.
5. Text wie gewohnt im Editor überarbeiten. Es gibt keine automatische Löschung oder Umformulierung. Änderungen lassen sich mit **Strg+Z** rückgängig machen.

Die Satzübersicht zeigt jeden Satz mit Wortzahl und proportionalem Balken. Anklicken führt zum Satz. Ausgewählte Satzteile heißen **Ausschnitt** und erhalten keine Satzlängenwarnung. Lange Listen haben jeweils 50 Einträge pro Seite.

**Lokal nach Eingabepause prüfen** ist standardmäßig ausgeschaltet. Eingeschaltet wird nach 1,5 Sekunden Schreibpause der aktive Abschnitt analysiert, solange diese Prüfansicht sichtbar ist. Das Öffnen der Ansicht allein startet keinen Lauf. Bei geschlossener Ansicht, anderem Verfahren oder Editorwechsel wird kein geplanter Lauf nachgeholt. Die Automatik gilt ausschließlich für die lokale Stilanalyse; Online-Prüfungen bleiben ausdrücklich zu starten.

## Regeln und Grenzen

Zum Ausprobieren eignet sich dieser Abschnitt. Er enthält eine Wiederholung, „eigentlich“ und einen Satz mit 30 Wörtern:

> Das Fenster steht offen. Das Fenster klappert eigentlich.
>
> Als Mara an diesem Morgen durch den verlassenen Garten ging und vor dem alten Haus stehen blieb, bemerkte sie trotz des dichten Nebels plötzlich einen schwachen Lichtschein hinter dem Vorhang.

- Wiederholungen: ganze Wörter mit mindestens vier Buchstaben; Groß-/Kleinschreibung wird vereinheitlicht, Unicode wird normalisiert. Gemeldet wird das erneute Wort im selben oder folgenden Satz bei höchstens 40 Wörtern Abstand. Benachbarte Fließtextabsätze werden einbezogen. Die unten genannten Funktionswörter und vollständig erkannte, verfügbare Kartennamen einschließlich Aliasnamen bleiben ausgenommen. Erkennung der Kartennamen folgt deren exakter Schreibweise. Keine Wortstämme, Synonyme oder Pronomenzuordnung.
- Satzlängen: **lang ab 30**, **sehr lang ab 45 Wörtern**. Eine Orientierung für den Lesefluss, keine Qualitätsnote. Die lokale Satztrennung berücksichtigt unter anderem `Dr.`, `Prof.`, `z. B.`, `d. h.`, `u. a.`, `u. U.`, `v. a.`, `i. d. R.`, Zahlen und Datumsangaben wie `3. September`. Beliebige Abkürzungen und unkonventionelle Zeichensetzung sind nicht vollständig sprachlich interpretierbar.
- Füllwörter und Floskeln: `eigentlich`, `irgendwie`, `gewissermaßen`, `gewissermassen`, `sozusagen`, `quasi`, `letztendlich`, `im Grunde genommen`, `letzten Endes`, `an und für sich`, `zum jetzigen Zeitpunkt`. Ganze Wörter beziehungsweise Wortfolgen, auch über Formatierungswechsel, mit Vorrang für längere Wortfolgen.

Dialoge werden mitgeprüft; eine Formulierung kann bewusst zur Stimme einer Figur gehören. Hinweise sind Anregungen zur Entscheidung des Autors. Passiverkennung, Nominalstilanalyse und KI-Umschreibungen sind nicht enthalten. Ein Ausdruck kann sowohl als Wiederholung als auch als mögliche Floskel auffallen; die Hinweise benennen unterschiedliche Aspekte.

Deutsch für Deutschland, Österreich und Schweiz wird unterstützt. Überschriften, Code, Fußnoteninhalt, Kommentarinhalt und eingebettete Medien werden nicht analysiert. Der normale Text, an dem ein Kommentar hängt, bleibt Fließtext. Ausgeschlossene Elemente unterbrechen den Vergleich. Formatierung und Links allein unterbrechen einen Satz nicht. Texte werden nicht nach 8.000 Zeichen geteilt. Die Obergrenze beträgt eine Million ausgewählte Textzeichen.

## Datenerhalt

Analyse und Markierungen verändern weder den gespeicherten Text noch Rückgängig-Verlauf oder Export. Text-, Editor-, Projekt-, Sprach-, Karten- und Verfahrenswechsel verwerfen veraltete Ergebnisse. **Abbrechen** beendet einen laufenden Analyseauftrag.

Im Schreibschutz ist die Analyse verfügbar; dauerhafte Einstellungsänderungen sind gesperrt. Einstellungen werden erst nach erfolgreichem Speichern bestätigt. Scheitert dies, bleibt die vorherige Einstellung wirksam und die Fehlermeldung sichtbar; ungespeicherte Manuskripteingaben bleiben im Editor.

## Feste Ausschlussliste für Wiederholungen

Die Liste ist bewusst klein und keine grammatische Wortartenerkennung:

aber, also, auch, beim, bereits, besonders, bist, danach, dann, darauf, darum, dazu, dein, deine, deinem, deinen, deiner, deines, denen, denn, deren, deshalb, dessen, diese, diesem, diesen, dieser, dieses, doch, dort, durch, dürfen, durfte, dürfte, durften, dürften, eine, einem, einen, einer, eines, etwas, eure, eurem, euren, eurer, eures, habe, haben, habt, hast, hatte, hätte, hatten, hätten, hier, hinter, ihre, ihrem, ihren, ihrer, ihres, immer, jede, jedem, jeden, jeder, jedes, jene, jenem, jenen, jener, jenes, kann, keine, keinem, keinen, keiner, keines, können, konnte, könnte, konnten, könnten, mehr, meine, meinem, meinen, meiner, meines, mich, möchte, möchten, mögen, muss, müssen, musste, müsste, mussten, müssten, nach, neben, nicht, noch, oder, ohne, sehr, seid, sein, seine, seinem, seinen, seiner, seines, selbst, sich, sind, soll, sollen, sollte, sollten, sondern, über, unsere, unserem, unseren, unserer, unseres, unter, viele, vielleicht, vom, wann, wäre, waren, wären, warum, weil, welche, welchem, welchen, welcher, welches, wenn, werde, werden, will, wird, wollen, wollte, wollten, wurde, würde, wurden, würden, zum, zwischen.
