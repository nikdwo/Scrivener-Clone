# Schreibatelier – Alpha 5

Version **0.1.0-alpha.5**, Tag **v0.1.0-alpha.5**. Vorabversion für Windows x64.

**Paketprüfung:** Die portable Version bestand nativen Start, Ordnerumzug und vollständigen Neustart einschließlich Stilanalyse und Zeitstrahl. Der interne Installerprozess wurde auf dem Prüfrechner von der Windows-Signaturrichtlinie blockiert; Installation und Deinstallation von Alpha 5 sind dort nicht bestätigt.

## Neu gegenüber Alpha 4

- **Lokale deutsche Stilanalyse:** Unter **Prüfen → Prüfverfahren → Stilanalyse · lokal** Wortwiederholungen, lange Sätze und mögliche Füllwörter oder Floskeln untersuchen. Kategorien sind einzeln wählbar; eine anklickbare Satzübersicht zeigt Wortzahlen. Die Prüfung startet manuell für den Abschnitt oder die markierte Passage; die Automatik nach Eingabepause ist optional. Kein Konto, Netzwerk oder LanguageTool-Prozess erforderlich.
- **Szenen-Zeitstrahl mit Handlungssträngen:** Über **Ansicht → Zeitstrahl** relative Tage oder Kalenderdaten einrichten. Szenen erhalten rechts unter **Details → Zeit & Handlung** Beginn, optionales Ende und eine Handlung. Überlappende Szenen werden in getrennten Zeilen dargestellt. Nach Handlung sowie dauerhaft zugeordneten Figuren, Orten und Gegenständen filtern; Zoom und Ausschnitt erleichtern die Navigation.
- Zeiten, Handlungen und Stileinstellungen werden im bestehenden Projekt gespeichert. Der Zeitstrahl verändert weder Manuskriptreihenfolge noch Text. Stilhinweise sind Editoranzeigen und erscheinen nicht im Export. Karten, Papierkorb und bisherige Sprachprüfungen bleiben enthalten.

## Downloads und Aktualisieren

- **Schreibatelier-0.1.0-alpha.5-Setup-win-x64.exe**: Windows-Installer für das Benutzerkonto; danach **Schreibatelier Alpha 5** im Startmenü öffnen.
- **Schreibatelier-0.1.0-alpha.5-Portable-win-x64.zip**: vollständig in einen beschreibbaren Ordner entpacken und `Schreibatelier.exe` starten.
- **SHA256SUMS.txt**: Prüfsummen beider Pakete.

[Öffentliche Downloads](https://github.com/nikdwo/Schreibatelier-Releases/releases/tag/v0.1.0-alpha.5). Der Quellcode bleibt privat.

Ab Alpha 3 steht **Hilfe → Nach Updates suchen …** zur Verfügung. Bei Alpha 1 und Alpha 2 einmalig manuell herunterladen. Vor dem Wechsel Schreibatelier schließen und wichtige Projekte sichern. Portabel den bestehenden `Data`-Ordner und eigene Projektdateien beibehalten; beim Wechsel in einen neuen Ordner `Data` mitkopieren. Installierte Versionen verwenden weiterhin `%LocalAppData%\Schreibatelier`.

Die .NET-Laufzeit und lokale deutsche Sprachprüfung sind enthalten. Microsoft Edge WebView2 Runtime muss vorhanden sein. Pandoc und Typst für erweiterte Import-/Exportformate werden separat eingerichtet; Anleitung und Skripte liegen bei.

## Grenzen und Prüfung

**Frühe, nicht digital signierte Testversion.** SHA-256 prüft die Dateiintegrität, keine Herausgebersignatur. Die Stilanalyse gibt regelbasierte Hinweise ohne automatische Umformulierung. Die gewählte Zeitbasis bleibt im Projekt fest; Ziehen von Ereignissen, Kalenderumrechnung, eigene Kalender und automatische Logikwarnungen sind nicht enthalten.

Anleitungen mit Testtext und Beispielprojektablauf: `docs/STILANALYSE.md` und `docs/ZEITSTRAHL.md`. Die Nachweise für Logik, Oberfläche, Speicherung und native Laufzeit stehen in `docs/VALIDIERUNG.md`.

Windows-Release-Build, TypeScript-Prüfung, 19 JavaScript-Logiktests, 161 Core-/Konverterprüfungen, acht Prüfungen der lokalen Sprachprüfung und alle 39 Edge-Oberflächentests bestanden. Das Lizenzinventar bestätigt 71 Komponenten. Beide Pakete enthalten dieselben nativ geprüften Programmdateien und aktualisierte Begleitdokumente.

LanguageTool Premium ist weiterhin nicht mit einem echten Premium-Konto abgenommen; Claude-Abos sind nicht angebunden. Ein zweiter Rechner und längere tägliche Nutzung wurden für Alpha 5 nicht geprüft. Die bestätigte Alpha-4-Installation durch den Anwender bleibt separat dokumentiert.
