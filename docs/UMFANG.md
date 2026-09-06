# Funktionsabdeckung – Alpha 4 (0.1.0-alpha.3)

Stand: 6. September 2026. Diese Datei beschreibt implementiertes Verhalten und seine Grenzen. Sie ist keine Zusicherung vollständiger Scrivener-Kompatibilität.

Neu in Alpha 4: Figuren-, Orts- und Gegenstandskarten mit Namen/alternativen Namen, vorgegebenen und eigenen Textfeldern, Szenenzuordnungen, lokaler automatischer Namenserkennung und ausdrücklichen Textverweisen. Karten öffnen rechts im Notizbuch, ohne die Szene zu wechseln. Details und Grenzen: [Figuren, Orte & Gegenstände](FIGUREN-UND-ORTE.md).

| Bereich | Implementiert | Grenze |
|---|---|---|
| Updates | Öffentliche GitHub Releases ohne Anmeldung, abschaltbare Startprüfung, Versionsvergleich einschließlich Alpha/Beta, Download mit SHA-256, Installerstart nach Speichern/Sichern | Kein stiller Installerstart; portable Programmdateien werden manuell ausgetauscht. Windows kann unsignierte Pakete blockieren |
| Startseite | Die letzten drei erfolgreich geöffneten Projekte mit direktem Zugriff, lokal gespeicherter Reihenfolge und Pfadanzeige | Verschobene Dateien müssen über Projekt öffnen neu ausgewählt werden |
| Projekte | SQLite-Einzeldatei, lokale Anhänge, Neu/Öffnen/Kopie, automatische und manuelle Sicherung, Wiederherstellung in neue Datei | Keine Cloud-Synchronisation, keine Verschlüsselung, kein `.scriv`-Import |
| Struktur | Kapitel und Texte, Verschieben, Reihenfolge, Duplikat, atomisches Teilen/Zusammenführen, Papierkorb | Zusammenführen verlangt einen zweiten Abschnitt ohne lebende Unterabschnitte; Duplikat kopiert einen Abschnitt |
| Ansichten | Text, mehrere Abschnitte zusammen, geordnete/freie Pinnwand, tabellarische Gliederung, zusätzliche Leseansicht, Fokus, hell/dunkel | Zweite Ansicht ist schreibgeschützt; Gliederung öffnet zum Bearbeiten den Abschnitt; Texteditor hat keine tatsächlichen Druckseiten |
| Editor | Überschriften, fett/kursiv/unterstrichen/durchgestrichen, Listen, Zitat, Ausrichtung, Schrift/Größe/Zeilenabstand/Farben, hoch-/tiefgestellt, Tabellen, Bilder, Undo/Redo | Schriftgestaltung im Editor ist vom Ausgabeprofil getrennt; PDF-Seitenumbrüche werden in der Druckvorschau beurteilt |
| Anmerkungen | Kommentare an markiertem Text, Fußnoten, bearbeitbare Liste, Endnoten und Kommentar-Anhang beim Export | Anmerkungstexte sind Klartext; kein gemeinsames Bearbeiten, keine Änderungsverfolgung anderer Autoren |
| Organisation | Synopsis, Status, Farbe, Schlagwörter, Notizen, Wortziel, eigene Metadaten, dynamische/manuelle Sammlungen, mitgelieferte und eigene Vorlagen | Dynamische Sammlungen suchen in Titel/Metadaten; Volltextsuche ist separat |
| Suche | Unicode-Suche in Text/Titel/Metadaten, höchstens 500 Ergebnisse; Markieren, Ersetzen im Abschnitt/Projekt mit Sicherung | Ersetzen unterscheidet Groß-/Kleinschreibung, sucht im Haupttext innerhalb eines Absatzes, ohne Anmerkungen |
| Sprachprüfung | Deutsch DE/AT/CH; lokale LanguageTool-Engine; gemeinsame Prüfansicht mit Markierungen, Einzelkorrektur, Undo und Projektwörterbuch; Anschlüsse für LanguageTool Premium und ChatGPT-Abo/Codex | Lokale Prüfung und ChatGPT-Prüfung mit GPT-5.6-Sol an einem deutschen Beispielsatz tatsächlich getestet; LanguageTool Premium noch ohne Prüfung mit Benutzerkonto. Fußnotentexte werden nicht geprüft. Ein Abschnitt/markierter Text pro Lauf, keine automatische Online-Prüfung |
| Textstände | Vollständiger Editorbaum und Metadaten, Wiederherstellung mit Sicherung des vorherigen Stands | Visueller Vergleich zeigt nur Haupttextänderungen, keine Formatierung/Anhänge/Noten |
| Ziele | Manuskript-/Abschnitts-/Sitzungswortziel, Wörter/Zeichen, Tagesverlauf von Textbearbeitungen | Sitzung zählt netto seit Projektöffnung; Tagesverlauf zählt Änderungen beim Speichern, keine Schreibzeitmessung |
| Recherche | PDF, Bilder, HTML, Audio/Video als lokale Anhänge; Original speichern; Referenzansicht | HTML ohne Skripte/Netzwerk; Medienwiedergabe hängt von den Windows/WebView2-Codecs ab; kein OCR oder Medien-Transkript |
| Drehbuch | Fountain-Quelltext, sichtbare Grundelemente wie Szene/Figur/Dialog/Regie/Übergang; Syntaxzeichen und Leerzeilen bleiben beim direkten Read/Write erhalten | Kein normierter Filmseiten-Satz, keine nebeneinander gesetzten simultanen Dialoge; Markup bleibt im Editor sichtbar |

## Dateiformate

| Format | Import | Export | Hinweise |
|---|---|---|---|
| TXT | Ja | Ja | Klartext; keine Formatierung oder Fußnoten |
| Fountain | Ja | Ja | Sichtbarer Quelltext; ohne Abschnittstitel/Trenner eignet sich ein einzelner Abschnitt für einen Syntax-Rundlauf |
| OPML | Ja | Ja | Hierarchie, Titel und Klartextnotizen; kein Rich Text |
| Markdown | Ja | Ja | Pandoc; lokale Begleitbilder beim Import werden aus Sicherheitsgründen nicht automatisch aus beliebigen Nachbarpfaden gelesen |
| HTML | Ja | Ja | Export bettet Bilder ein; aktives Markup wird beim Import verworfen |
| DOCX | Ja | Ja | Text, grundlegende Formatierung, Listen, Tabellen, Fußnoten und eingebettete Bilder geprüft |
| RTF | Ja | Ja | Text-Rundlauf geprüft; komplexe eingebettete Objekte nicht zugesichert |
| ODT | Ja | Ja | Text, Fußnoten und eingebettete Bilder geprüft |
| PDF | Nein, Rechercheanhang | Ja | Pandoc + Typst; dieselbe Pipeline erzeugt die Druckvorschau |
| EPUB | Nein | Ja | Pandoc EPUB3 mit Bildern; kein E-Book-Shop-Upload |
| LaTeX | Nein | Ja | Textausgabe `.tex`, keine TeX-Installation erforderlich |

Markdown- und LaTeX-Bilder liegen nach Export in einem mit ausgegebenen `Schreibatelier-assets-…`-Nachbarordner. Dieser gehört zur Ausgabe. Ein Import verändert die Originaldatei nicht und weist auf verworfene Elemente hin. Layout, individuelle Office-Vorlagen, spezielle Tabellenformatierung, Änderungen/Kommentare fremder Office-Dateien und beliebige nicht unterstützte Dokumentelemente können abweichen oder entfallen.

Nicht enthalten: Legacy `.doc`, FDX, direkte Scrivener-Dateiformate, mobile Apps, Synchronisationsdienst, Authenticode-Signatur und unbeaufsichtigte Update-Installation. Das gebaute Paket ist eine lokale Windows-x64-Version; ein Laufzeittest auf einem zweiten Rechner ist noch nicht erfolgt.

## Größen und Datenverhalten

- Ein Textabschnitt: höchstens 32 MB JSON; Textimport: 64 MB pro Datei; Anhänge: 256 MB pro Datei.
- OPML: höchstens 10.000 Abschnitte und 40 Verschachtelungsebenen.
- Zusammenhängende Editoransicht lädt jeweils 30 weitere Abschnitte. Die Projektübersicht lädt nur Zusammenfassungen, nicht sämtliche Texte.
- Dateiformatversion 1. Unbekannte neuere Formate und beschädigte Datenbanken werden abgewiesen. Es gibt noch keine ältere produktive Formatversion, aus der eine Migration erforderlich wäre.
- Bestätigte Speicherstände überleben den geprüften Prozessabbruch. Noch nicht bestätigte Tastenanschläge können bei Prozess-/Rechnerausfall verloren gehen.
