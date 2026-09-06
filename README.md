# Schreibatelier

Eine eigenständige, lokale Windows-Schreibanwendung für längere Texte. Version 0.1.0, privates Projekt. Der Arbeitsordner war vor der Umsetzung leer; Anwendung, Datenmodell und Oberfläche wurden neu erstellt.

## Starten

**Im Projektordner einfach „Schreibatelier starten“ doppelklicken.** Die Windows-Verknüpfung öffnet die fertige Anwendung. Jeder Release-Build erstellt bzw. aktualisiert sie automatisch; nach dem Verschieben des Quellprojektordners lässt sie sich mit `scripts/create-shortcut.ps1` neu erzeugen.

Das ZIP `artifacts/Schreibatelier-0.1.0-win-x64.zip` vollständig entpacken und **Schreibatelier.exe** im entpackten Ordner starten. Alternativ liegt die fertige Anwendung unter `artifacts/Schreibatelier/Schreibatelier.exe`. Die DLLs und der Ordner `Web` gehören dazu. Die .NET-Laufzeit wird mitgeliefert. Microsoft Edge **WebView2 Runtime** muss installiert sein; sie ist auf dem hier geprüften Rechner vorhanden.

Über **Datei → Neues Projekt** eine `.schreibprojekt`-Datei anlegen. Darin werden Text, Projektstruktur, Rechercheanhänge und Textstände gespeichert. Eine vorhandene Datei wird beim Anlegen eines Projekts niemals überschrieben.

Für DOCX/RTF/ODT/Markdown/HTML-Import und die erweiterten Ausgabeformate wird **Pandoc** benötigt, für PDF zusätzlich **Typst**. Im Quellprojekt sind die geprüften Versionen bereits unter `.tools` installiert. Für einen separat entpackten Anwendungsordner:

```powershell
& .\scripts\install-tools.ps1
```

Das Skript lädt die festgelegten Originalpakete, prüft SHA-256 und entpackt sie ausschließlich nach `.tools`. Es ändert weder PATH noch die Windows-Installation. Bereits installierte Konverter lassen sich unter **Hilfe → Einstellungen** auswählen. Weitere Informationen: [Pandoc](https://pandoc.org/installing.html), [Typst](https://typst.app/open-source/), [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/).

## Benutzen

- Links Kapitel, Texte und Recherche anlegen. Ziehen verschiebt einen Abschnitt; das Abschnittsmenü bietet dieselbe Aktion mit Ziel- und Positionsauswahl. Pinnwand und Gliederung zeigen die Unterabschnitte der Auswahl. Karten per Doppelklick oder Eingabetaste öffnen.
- In der Mitte schreiben. Die Werkzeugleiste unterstützt Absatzarten, Listen, Tabellen, Bilder, Links, Formatierung, Kommentare und Fußnoten. Weitere Schriftwerkzeuge und interne Verweise stehen unter `•••` in der Werkzeugleiste. Mit **Mit Unterabschnitten** zusammenhängend arbeiten; längere Projekte laden weitere Abschnitte auf Anforderung.
- Rechts Zusammenfassungen, Status, Farbe, Schlagwörter, Wortziele, eigene Felder und Notizen führen. Unter **Stände** Fassungen sichern, vergleichen und wiederherstellen. Anmerkungen über die Liste oder Doppelklick im Text bearbeiten.
- **Vorlagen** enthält eigene Ausgangstexte für Figuren, Orte, Szenen, Drehbücher und Recherche. Über das Abschnittsmenü lassen sich zusätzlich eigene Textvorlagen im Projekt speichern.
- Sammlungen wählen Abschnitte manuell oder anhand von Titel/Metadaten. Verwaltung und Hinzufügen stehen im Abschnittsmenü.
- **Strg+S** speichert sofort. **F11** schaltet den Fokusmodus um, **Escape** beendet ihn. **Zweite Ansicht** öffnet einen Abschnitt oder Anhang zum Nachschlagen. Im schmalen Fenster öffnet **Notizbuch** den Inspektor.
- Projektsuche links; **Suchen** in der Werkzeugleiste markiert oder ersetzt Text, auch über unterschiedliche Textformatierung hinweg. Projektweite Ersetzungen legen vorher Textstände an und werden gemeinsam gespeichert.
- **Exportieren** wählt Abschnitte, Titel, Autor, Inhaltsverzeichnis, Kommentare, Endnoten und Seitengröße. **Druckvorschau** erstellt ein PDF und öffnet es im zugeordneten PDF-Programm; dort kann gedruckt werden.

## Speicherung und Wiederherstellung

Autosave erfolgt nach einer Sekunde Eingabepause beziehungsweise spätestens im Fünf-Sekunden-Intervall. Erst die bestätigte Meldung **Alle Änderungen gespeichert** bedeutet, dass die Datenbanktransaktion abgeschlossen ist. Scheitert Speichern, bleibt die Eingabe im Editor und der Abschnittswechsel wird abgebrochen. Strg+S versucht das Speichern erneut.

Beim Öffnen und Schließen eines schreibbaren Projekts entstehen geprüfte Sicherungskopien unter `%LocalAppData%\Schreibatelier\Backups\<Projektkennung>`. Die letzten 20 Kopien bleiben erhalten. **Datei → Sicherung wiederherstellen** schreibt eine neue Projektdatei. Eine zweite Instanz desselben Projekts öffnet es schreibgeschützt. Die `.lockfile` neben dem Projekt ist eine Sperrdatei; ihr bloßes Vorhandensein sperrt nichts, entscheidend ist die geöffnete Dateisperre.

Die lokale Sicherung schützt nicht vor dem Ausfall desselben Laufwerks. Eine zusätzliche Projektkopie kann über **Kopie speichern** auf einem anderen Datenträger abgelegt werden. Die Anwendung implementiert keine Synchronisation; eine laufend geöffnete Datenbank ist nicht für gleichzeitige Änderungen auf mehreren Rechnern vorgesehen.

## Umfang und Grenzen

Die konkrete Funktions- und Formatabdeckung steht in [docs/UMFANG.md](docs/UMFANG.md), technische Prüfungen in [docs/VALIDIERUNG.md](docs/VALIDIERUNG.md). Ein vollständig identischer Funktionsumfang zu Scrivener wird nicht behauptet. Insbesondere bleiben erweiterter Drehbuchsatz, Formatierungsvergleich zwischen Textständen und verlustfreier Import beliebiger Office-Dateien außerhalb der bestätigten Abdeckung dieser Version.

## Quellprojekt bauen und prüfen

Voraussetzungen: Windows x64, .NET SDK aus `global.json`, aktuelles Node.js mit npm und für die Oberflächentests Microsoft Edge. Alle direkten Pakete sind versioniert; npm- und NuGet-Lockdateien liegen bei.

```powershell
& .\scripts\build.ps1             # Abhängigkeiten, TypeScript-Prüfung, Debug-Build
& .\scripts\install-tools.ps1     # Einmalig: geprüfte Konverter
& .\scripts\test.ps1              # JavaScript- und Speicher-/Konverterprüfungen
npm.cmd run test:ui               # Browserprüfung mit Test-Bridge
& .\scripts\build.ps1 -Release    # Eigenständiges Windows-Paket und ZIP
```

`src/Schreibatelier.Core` enthält Speicherung und Konvertierung, `src/Schreibatelier.App` die Windows-Hülle und die kontrollierte Editor-Bridge. `web` enthält den lokalen Editor; `tests` enthält ausführbare Prüfungen. `.work`, `.tools`, `node_modules`, Build-Ausgaben und Benutzerprojekte werden nicht als Quellcode eingecheckt. Ein öffentliches Repository wurde nicht angelegt.

## Herkunft und Lizenzen

Es wurden keine Scrivener-Binärdateien dekompiliert und keine fremden Anwendungsdateien, Grafiken, Logos oder Handbuchtexte übernommen. Öffentliche Funktionsbeschreibungen dienten als Referenz. Die Umsetzung verwendet eigene UI- und Anwendungstexte.

[docs/HERKUNFT-UND-LIZENZEN.md](docs/HERKUNFT-UND-LIZENZEN.md) dokumentiert die geprüften Quellen und Entscheidungen. `THIRD_PARTY_NOTICES.txt`, `docs/licenses`, `docs/components.json` und `docs/sbom.spdx.json` enthalten Lizenztexte und Inventar der installierten Entwicklungs- und Laufzeitabhängigkeiten. Eigener Anwendungscode bleibt privat; siehe `LICENSE`.
