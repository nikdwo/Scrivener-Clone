# Schreibatelier – Alpha 4

Eine eigenständige, lokale Windows-Schreibanwendung für längere Texte. **Alpha 4 (`0.1.0-alpha.4`)**, privates Projekt. Der Arbeitsordner war vor der Umsetzung leer; Anwendung, Datenmodell und Oberfläche wurden neu erstellt.

## Alpha 4 herunterladen und starten

**Frühe Testversion:** Verwende Kopien deiner Manuskripte und sichere wichtige Texte zusätzlich auf einem anderen Datenträger. [Release und Downloads auf GitHub](https://github.com/nikdwo/Schreibatelier-Releases/releases/tag/v0.1.0-alpha.4) sind als Vorabversion gekennzeichnet und ohne Anmeldung erreichbar. Der Quellcode bleibt privat.

| Download | Verwendung |
| --- | --- |
| [Windows-Installer](https://github.com/nikdwo/Schreibatelier-Releases/releases/download/v0.1.0-alpha.4/Schreibatelier-0.1.0-alpha.4-Setup-win-x64.exe) | Für dein Benutzerkonto installieren; Startmenü-Eintrag, optionale Desktop-Verknüpfung und Deinstaller. |
| [Portables ZIP](https://github.com/nikdwo/Schreibatelier-Releases/releases/download/v0.1.0-alpha.4/Schreibatelier-0.1.0-alpha.4-Portable-win-x64.zip) | Vollständig in einen beschreibbaren Ordner entpacken und `Schreibatelier.exe` starten. Die Datei `portable.txt` aktiviert den portablen Modus. |

Im portablen Modus liegen Einstellungen, automatische Sicherungen, Vorschauen und WebView-Daten unter `Data` neben der EXE. Zum Umziehen den gesamten Ordner bei geschlossener Anwendung kopieren. Manuskripte bleiben an dem Ort, den du beim Speichern auswählst; außerhalb abgelegte Projekte müssen separat mitgenommen werden. Temporäre Konverterdateien verwenden weiterhin den Windows-Temp-Ordner.

Die installierte Variante verwendet `%LocalAppData%\Schreibatelier`. Eine Deinstallation lässt eigene Projekte, Einstellungen und Sicherungen bestehen. Die Pakete sind nicht digital signiert; Windows kann deshalb einen unbekannten Herausgeber anzeigen. Prüfsummen liegen als `SHA256SUMS.txt` beim Release. [Details und Grenzen der Alpha 4](docs/RELEASE-ALPHA-4.md).

Auf dem Prüfrechner blockierte die Windows-Anwendungssteuerung den portablen Programmstart und den internen Installerprozess wegen der Signaturanforderungen. Nativer Start, Installation und Deinstallation der Alpha-4-Pakete sind dort deshalb noch nicht bestätigt. Die Prüfungen und bekannten Grenzen stehen in [Validierung](docs/VALIDIERUNG.md).

## Updates über GitHub

Unter **Hilfe → Nach Updates suchen …** prüft die Anwendung die [öffentlichen Downloads](https://github.com/nikdwo/Schreibatelier-Releases/releases). Eine GitHub-Anmeldung und ein eigener Server sind dafür nicht nötig; der Quellcode bleibt im privaten Repository. Die Prüfung beim Programmstart ist standardmäßig eingeschaltet und lässt sich im Updatefenster deaktivieren. Es werden keine Manuskripttexte übertragen. Ohne Internet kann normal weitergeschrieben werden.

Eine neue Versionsnummer muss als GitHub **Release** mit passenden Windows-Dateien veröffentlicht sein; ein Push auf `main` oder `testing` genügt nicht. Alpha-/Beta-Installationen berücksichtigen Vorabversionen; stabile Installationen erhalten nur stabile Releases. Download und Installation erfolgen erst nach Klick. Der Download wird auf Größe und SHA-256 geprüft. Das ist eine Integritätsprüfung, keine Herausgebersignatur.

Bei der installierten Variante speichert und sichert **Speichern und Installer starten** das offene Projekt, startet den vorhandenen Windows-Installer und schließt Schreibatelier. Bei einem Speicherfehler bleibt die Anwendung offen. Bei der portablen Variante **Downloadordner öffnen**, die Anwendung schließen und das ZIP in den bisherigen Programmordner entpacken; Programmdateien ersetzen und `Data` sowie eigene Projekte beibehalten. Bei einem neuen Zielordner den bisherigen `Data`-Ordner bei geschlossener Anwendung mitkopieren. Der portable Austausch erfolgt manuell.

Für künftige Veröffentlichungen zuerst eine höhere Versionsnummer in Anwendung und Paketierung setzen, die Pakete prüfen und das Quellrelease veröffentlichen. Danach `./scripts/publish-updates.ps1 -Version '0.1.0-alpha.4'` mit der tatsächlich veröffentlichten Version ausführen. Das Skript überträgt ausschließlich Installer, ZIP und Prüfsummen aus dem bestehenden Quellrelease; kein Quellcode wird veröffentlicht. Bereits veröffentlichte Dateien werden nicht überschrieben. Alpha 3 kann Alpha 4 über die Updatefunktion beziehen. Die Alpha-1-/Alpha-2-Pakete benötigen einmalig den manuellen Download.

## Aus dem Quellprojekt starten

**Im Projektordner einfach „Schreibatelier starten“ doppelklicken.** Die Windows-Verknüpfung öffnet die fertige Anwendung. Jeder Release-Build erstellt bzw. aktualisiert sie automatisch; nach dem Verschieben des Quellprojektordners lässt sie sich mit `scripts/create-shortcut.ps1` neu erzeugen.

Die Pakete liegen nach einem Release-Build unter `artifacts/releases/0.1.0-alpha.4/`. Die gebaute Anwendung liegt unter `artifacts/Schreibatelier-0.1.0-alpha.4/app/Schreibatelier.exe`. Die DLLs und der Ordner `Web` gehören dazu. Die .NET-Laufzeit wird mitgeliefert. Microsoft Edge **WebView2 Runtime** muss installiert sein; sie ist auf dem hier geprüften Rechner vorhanden.

Über **Datei → Neues Projekt** eine `.schreibprojekt`-Datei anlegen. Darin werden Text, Projektstruktur, Rechercheanhänge und Textstände gespeichert. Eine vorhandene Datei wird beim Anlegen eines Projekts niemals überschrieben.

Die Startseite zeigt unter **Zuletzt geöffnet** die letzten drei erfolgreich geöffneten Projekte mit Name und Speicherort. Ein Klick öffnet das Projekt direkt; erneutes Öffnen setzt es an den Anfang. Die Liste wird lokal gespeichert und füllt sich ab der ersten Nutzung dieser Funktion. Bei verschobenen oder nicht verfügbaren Dateien über **Projekt öffnen** den aktuellen Speicherort auswählen.

Für DOCX/RTF/ODT/Markdown/HTML-Import und die erweiterten Ausgabeformate wird **Pandoc** benötigt, für PDF zusätzlich **Typst**. Im Quellprojekt sind die geprüften Versionen bereits unter `.tools` installiert. Für einen separat entpackten Anwendungsordner:

```powershell
& .\scripts\install-tools.ps1
```

Das Skript lädt die festgelegten Originalpakete, prüft SHA-256 und entpackt sie ausschließlich nach `.tools`. Es ändert weder PATH noch die Windows-Installation. Bereits installierte Konverter lassen sich unter **Hilfe → Einstellungen** auswählen. Weitere Informationen: [Pandoc](https://pandoc.org/installing.html), [Typst](https://typst.app/open-source/), [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/).

## Benutzen

**Auf `testing`:** Die neue [lokale deutsche Stilanalyse](docs/STILANALYSE.md) ergänzt Wiederholungs-, Satzlängen- und Formulierungshinweise. Mit `scripts/build.ps1 -Testing` entsteht eine startbare Testversion; **Schreibatelier starten** verweist anschließend auf diesen Testbuild. In der Anwendung **Prüfen → Prüfverfahren → Stilanalyse · lokal** wählen. Diese Erweiterung ist noch nicht in den Alpha-4-Downloads enthalten.

**Neu in Alpha 4:** [Figuren-, Orts- und Gegenstandskarten mit automatischer Namenserkennung](docs/FIGUREN-UND-ORTE.md). Die Karten gehören zu den oben verlinkten Alpha-4-Paketen.

Ein **Rechtsklick auf einen Eintrag → In den Papierkorb verschieben** öffnet das Löschmenü für Abschnitte, Ordner, Recherchedateien, Figuren, Orte und Gegenstände. Alternativ den Eintrag mit der Tastatur fokussieren und **Umschalt+F10** drücken. Nach der Bestätigung verschwindet der Eintrag aus der Liste; unter **Papierkorb → Wiederherstellen** kommt er zurück. Ordner umfassen ihre Untereinträge. Die festen Projektbereiche bleiben erhalten; schreibgeschützte Projekte lassen keine Änderungen zu.

- Links Kapitel, Texte und Recherche anlegen. Ziehen verschiebt einen Abschnitt; das Abschnittsmenü bietet dieselbe Aktion mit Ziel- und Positionsauswahl. Pinnwand und Gliederung zeigen die Unterabschnitte der Auswahl. Karten per Doppelklick oder Eingabetaste öffnen.
- In der Mitte schreiben. Die Werkzeugleiste unterstützt Absatzarten, Listen, Tabellen, Bilder, Links, Formatierung, Kommentare und Fußnoten. Weitere Schriftwerkzeuge und interne Verweise stehen unter `•••` in der Werkzeugleiste. Mit **Mit Unterabschnitten** zusammenhängend arbeiten; längere Projekte laden weitere Abschnitte auf Anforderung.
- Rechts Zusammenfassungen, Status, Farbe, Schlagwörter, Wortziele, eigene Felder und Notizen führen. Die linke Notizbuchkante ziehen, um die Breite anzupassen; mit Tab ausgewählt funktionieren auch die Pfeiltasten. Die Breite wird lokal gespeichert. Unter **Stände** Fassungen sichern, vergleichen und wiederherstellen. Anmerkungen über die Liste oder Doppelklick im Text bearbeiten.
- **Vorlagen** öffnet die Kartenerstellung für Figuren, Orte und Gegenstände oder Ausgangstexte für Szenen, Drehbücher und Recherche. Über das Abschnittsmenü lassen sich zusätzlich eigene Textvorlagen im Projekt speichern. Bestehende Vorlagentexte bleiben erhalten.
- Sammlungen wählen Abschnitte manuell oder anhand von Titel/Metadaten. Verwaltung und Hinzufügen stehen im Abschnittsmenü.
- **Strg+S** speichert sofort. **F11** schaltet den Fokusmodus um, **Escape** beendet ihn. **Zweite Ansicht** öffnet einen Abschnitt oder Anhang zum Nachschlagen. Im schmalen Fenster öffnet **Notizbuch** den Inspektor.
- Projektsuche links; **Suchen** in der Werkzeugleiste markiert oder ersetzt Text, auch über unterschiedliche Textformatierung hinweg. Projektweite Ersetzungen legen vorher Textstände an und werden gemeinsam gespeichert.
- **Prüfen** in der Werkzeugleiste oder im Notizbuch öffnet die Sprachprüfung. Deutsch für Deutschland, Österreich und die Schweiz ist auswählbar. Die lokale Rechtschreib- und Grammatikprüfung wird mitgeliefert. Markierten Text oder den aktuellen Abschnitt prüfen, einzelne Vorschläge übernehmen oder ignorieren; **Strg+Z** macht Korrekturen rückgängig. Das Projektwörterbuch erlaubt eigene Namen und Begriffe. Automatische Prüfung nach Eingabepause ist optional und ausschließlich lokal.
- **LanguageTool Premium** wird unter **Prüfen → Prüfverfahren** über E-Mail und Zugriffsschlüssel verbunden. **ChatGPT-Abo · Codex** verwendet die separat installierte Codex CLI, eine eigene Browseranmeldung und die vom Anschluss gemeldete Modellliste. Nach der Browseranmeldung **Status aktualisieren** wählen. Online-Prüfungen werden ausdrücklich gestartet und senden den angezeigten Textumfang an den gewählten Anbieter. Abo-/API-Kontingente gelten weiterhin. Claude-Abos sind nicht angebunden. Einzelheiten und geprüfte Grenzen: [Sprachprüfung](docs/SPRACHPRUEFUNG.md).
- **Exportieren** wählt Abschnitte, Titel, Autor, Inhaltsverzeichnis, Kommentare, Endnoten und Seitengröße. **Druckvorschau** erstellt ein PDF und öffnet es im zugeordneten PDF-Programm; dort kann gedruckt werden.

## Speicherung und Wiederherstellung

Autosave erfolgt nach einer Sekunde Eingabepause beziehungsweise spätestens im Fünf-Sekunden-Intervall. Erst die bestätigte Meldung **Alle Änderungen gespeichert** bedeutet, dass die Datenbanktransaktion abgeschlossen ist. Scheitert Speichern, bleibt die Eingabe im Editor und der Abschnittswechsel wird abgebrochen. Strg+S versucht das Speichern erneut.

Beim Öffnen und Schließen eines schreibbaren Projekts entstehen geprüfte Sicherungskopien unter `%LocalAppData%\Schreibatelier\Backups\<Projektkennung>` (portabel: `Data/Backups/<Projektkennung>` neben der EXE). Die letzten 20 Kopien bleiben erhalten. **Datei → Sicherung wiederherstellen** schreibt eine neue Projektdatei. Eine zweite Instanz desselben Projekts öffnet es schreibgeschützt. Die `.lockfile` neben dem Projekt ist eine Sperrdatei; ihr bloßes Vorhandensein sperrt nichts, entscheidend ist die geöffnete Dateisperre.

Die lokale Sicherung schützt nicht vor dem Ausfall desselben Laufwerks. Eine zusätzliche Projektkopie kann über **Kopie speichern** auf einem anderen Datenträger abgelegt werden. Die Anwendung implementiert keine Synchronisation; eine laufend geöffnete Datenbank ist nicht für gleichzeitige Änderungen auf mehreren Rechnern vorgesehen.

## Umfang und Grenzen

Die konkrete Funktions- und Formatabdeckung steht in [docs/UMFANG.md](docs/UMFANG.md), technische Prüfungen in [docs/VALIDIERUNG.md](docs/VALIDIERUNG.md). Ein vollständig identischer Funktionsumfang zu Scrivener wird nicht behauptet. Insbesondere bleiben erweiterter Drehbuchsatz, Formatierungsvergleich zwischen Textständen und verlustfreier Import beliebiger Office-Dateien außerhalb der bestätigten Abdeckung dieser Version.

## Quellprojekt bauen und prüfen

Voraussetzungen: Windows x64, .NET SDK aus `global.json`, aktuelles Node.js mit npm und für die Oberflächentests Microsoft Edge. Für den Installer wird [Inno Setup](https://jrsoftware.org/isdl.php) benötigt (geprüft: 7.1.0 x64). `scripts/package.ps1` verwendet `.tools/InnoSetup/ISCC.exe`; ein anderer Compilerpfad kann mit `-Compiler` übergeben werden. Alle direkten Pakete sind versioniert; npm- und NuGet-Lockdateien liegen bei.

```powershell
& .\scripts\build.ps1             # Abhängigkeiten, TypeScript-Prüfung, Debug-Build
& .\scripts\install-tools.ps1     # Einmalig: geprüfte Konverter
& .\scripts\install-proofreading.ps1 # Einmalig: lokale Sprachprüfung und portable Java-Laufzeit
& .\scripts\test.ps1              # JavaScript- und Speicher-/Konverterprüfungen
npm.cmd run test:ui               # Browserprüfung mit Test-Bridge
& .\scripts\build.ps1 -Release    # Installer, portables ZIP und SHA-256-Prüfsummen
& .\scripts\test-release.ps1      # Paket-, Start-, Umzugs- und Deinstallationsprüfung
```

`src/Schreibatelier.Core` enthält Speicherung und Konvertierung, `src/Schreibatelier.App` die Windows-Hülle und die kontrollierte Editor-Bridge. `web` enthält den lokalen Editor; `tests` enthält ausführbare Prüfungen. `.work`, `.tools`, `node_modules`, Build-Ausgaben und Benutzerprojekte werden nicht als Quellcode eingecheckt. Ein öffentliches Repository wurde nicht angelegt.

## Herkunft und Lizenzen

Es wurden keine Scrivener-Binärdateien dekompiliert und keine fremden Anwendungsdateien, Grafiken, Logos oder Handbuchtexte übernommen. Öffentliche Funktionsbeschreibungen dienten als Referenz. Die Umsetzung verwendet eigene UI- und Anwendungstexte.

[docs/HERKUNFT-UND-LIZENZEN.md](docs/HERKUNFT-UND-LIZENZEN.md) dokumentiert die geprüften Quellen und Entscheidungen. `THIRD_PARTY_NOTICES.txt`, `docs/licenses`, `docs/components.json` und `docs/sbom.spdx.json` enthalten Lizenztexte und Inventar der installierten Entwicklungs- und Laufzeitabhängigkeiten. Eigener Anwendungscode bleibt privat; siehe `LICENSE`.
