# Schreibatelier – Beta 1

Version **0.2.0-beta.1**, Tag **v0.2.0-beta.1**. Öffentliche Vorabversion für Windows x64 zum Erproben und für Rückmeldungen.

## Neu gegenüber Alpha 6

- **A4-Schreibansicht:** Texte fließen über Seiten mit festen Rändern; die Ansicht skaliert mit dem verfügbaren Platz. PDF und Druckvorschau verwenden weiterhin ihr eigenes Ausgabeprofil.
- **Ordnerübersicht und Bedienung:** Übersicht der Unterabschnitte, direkter Zugang zum Ordnertext, Enter-Bestätigung in einzeiligen Dialogen und lesbare Auswahllisten im Dunkelmodus.
- **Zeitstrahl:** Szenen und Randgriffe lassen sich minutengenau verschieben. Jede Szene behält eine eigene Zeile in Manuskriptreihenfolge; Vorschau, Tastaturbedienung und Abbruch mit Escape sind enthalten.
- **Speichern und Projektwechsel:** Offene Änderungen werden vollständig gespeichert. Laufende Projektaktionen verhindern einen Wechsel, bis sie abgeschlossen sind; der Wechsel kann danach erneut angefordert werden. Fehlerhafte neue Projekte lassen das bisherige Projekt geöffnet.
- **Import, Export und Textstände:** Sichere interne Bildreferenzen, gemeinsames Speichern importierter Texte und Bilder, Erhalt von Anführungszeichen sowie gezieltes Laden einzelner Textstände. Konverter und ihre Unterprozesse werden bei Fehlern und Zeitüberschreitungen beendet.
- **Stabilität und Pflege:** Robustere Einstellungen einschließlich ungültiger Unicode-Daten, zuverlässigerer Abbau von Codex-Verbindungen, synchronisierte Premium-Trennung, begrenzter Updatecache und aktualisierte HTML-Bereinigung. Sammlungen und zweite Ansicht erhalten keine veralteten Editorzustände.

Die bestätigten Punkte der technischen Review einschließlich der nachgezogenen Restfälle sind korrigiert. Projektformat und SQLite-Schemaversion bleiben unverändert. Beziehungsnetz, Figuren-, Orts- und Gegenstandskarten, lokale Stilanalyse und Sprachprüfung bleiben enthalten.

## Downloads und Aktualisieren

- **Schreibatelier-0.2.0-beta.1-Setup-win-x64.exe**: Installer für das Windows-Benutzerkonto; danach **Schreibatelier Beta 1** im Startmenü öffnen.
- **Schreibatelier-0.2.0-beta.1-Portable-win-x64.zip**: vollständig in einen beschreibbaren Ordner entpacken und `Schreibatelier.exe` starten.
- **SHA256SUMS.txt**: Prüfsummen beider Pakete.

[Öffentliche Downloads](https://github.com/nikdwo/Schreibatelier-Releases/releases/tag/v0.2.0-beta.1). Der Quellcode bleibt privat.

Ab Alpha 3 steht **Hilfe → Nach Updates suchen …** zur Verfügung. Alpha 1 und Alpha 2 benötigen einen manuellen Download. Vor dem Wechsel Schreibatelier schließen und wichtige Projekte sichern. Portabel den bestehenden `Data`-Ordner und eigene Projektdateien beibehalten; beim Wechsel in einen neuen Ordner `Data` mitkopieren. Installierte Versionen verwenden weiterhin `%LocalAppData%\Schreibatelier`.

Die .NET-Laufzeit und lokale deutsche Sprachprüfung sind enthalten. Microsoft Edge WebView2 Runtime muss vorhanden sein. Pandoc und Typst für erweiterte Import-/Exportformate werden separat eingerichtet; Anleitung und Skripte liegen bei.

## Prüfung und Grenzen

**Release-Abnahme bestanden:** Windows-Release-Build, TypeScript-Prüfung, 252 Core-/Konverterprüfungen, 64 Sprachprüfungen, 23 Updateprüfungen, 28 JavaScript-Prüfungen, alle 87 Edge-Oberflächentests und 23 native WPF-/WebView2-Durchläufe. Keine ausgelassenen oder wiederholten UI-Fehlläufe. Das Lizenzinventar bestätigt 71 Komponenten.

Portabler Start, Ordnerumzug, vollständiger Neustart, Installation und Deinstallation wurden nativ geprüft. Testprojekte und Benutzerdaten blieben erhalten. Die Ergebnisse stehen in `docs/VALIDIERUNG.md`; die Anleitung zur Schreibansicht und Zeitstrahlbedienung liegt unter `docs/TESTVERSION-BEDIENUNG.md`.

**Nicht digital signierte Beta.** SHA-256 prüft die Dateiintegrität, keine Herausgebersignatur. Verwende Projektkopien und zusätzliche Sicherungen. Eine Installation auf einem zweiten Rechner und längere Alltagsnutzung sind noch nicht abgenommen. Echte Premium- und Codex-Anmeldungen gehören nicht zum Testnachweis dieser Veröffentlichung; Claude-Abos sind nicht angebunden.

Rückmeldungen sind besonders zu Schreiben, Speichern/Wiederöffnen, Import/Export und Zeitstrahlbedienung hilfreich. Bitte Version, Windows-Version, Schritte, erwartetes und tatsächliches Verhalten nennen; private Manuskripttexte und Zugangsdaten nicht mitsenden.
