# Schreibatelier – Alpha 6

Version **0.1.0-alpha.6**, Tag **v0.1.0-alpha.6**. Vorabversion für Windows x64.

**Paketprüfung bestanden:** Portabler Start, Ordnerumzug und vollständiger Neustart sowie Installation, Start der installierten Anwendung und Deinstallation wurden nativ geprüft. Beziehungen und Kartenpositionen blieben nach dem Neustart erhalten; die Deinstallation erhielt Testprojekte und Benutzerdaten.

## Neu gegenüber Alpha 5

- **Beziehungsnetz für Figuren, Orte und Gegenstände:** Über **Ansicht → Beziehungsnetz** vorhandene Karten verknüpfen. Beziehungen erhalten eine Bezeichnung und optionale Notizen; gerichtete und gegenseitige Verbindungen sowie mehrere unterschiedlich benannte Beziehungen zwischen denselben Karten sind möglich.
- Karten öffnen rechts im Notizbuch, Verbindungen über Linie, Beschriftung oder Beziehungsliste. Beziehungen werden ausdrücklich gespeichert oder abgebrochen. Das bisherige Figurenfeld bleibt als **Beziehungsnotizen** erhalten.
- Automatische Anordnung, verschiebbare Karten, Suche, direkte Nachbarn, Gesamtansicht und Zoom. Verschiebegriffe sind mit Pfeiltasten bedienbar; Eingabe speichert, Escape bricht eine laufende Verschiebung ab.
- Beziehungen und Positionen bleiben im Projekt gespeichert. Papierkorbverweise werden erhalten und nach Wiederherstellung wieder sichtbar. Speicherfehler behalten offene Eingaben; gleichzeitig geänderte andere Projekteinstellungen werden beim Speichern zusammengeführt.
- Manuskripttext und Reihenfolge bleiben unabhängig vom Netz. Karten, lokale Stilanalyse, Zeitstrahl, Sprachprüfung und die übrigen bisherigen Funktionen bleiben enthalten.

## Downloads und Aktualisieren

- **Schreibatelier-0.1.0-alpha.6-Setup-win-x64.exe**: Windows-Installer für das Benutzerkonto; anschließend **Schreibatelier Alpha 6** im Startmenü öffnen.
- **Schreibatelier-0.1.0-alpha.6-Portable-win-x64.zip**: vollständig in einen beschreibbaren Ordner entpacken und `Schreibatelier.exe` starten.
- **SHA256SUMS.txt**: Prüfsummen beider Pakete.

[Öffentliche Downloads](https://github.com/nikdwo/Schreibatelier-Releases/releases/tag/v0.1.0-alpha.6). Der Quellcode bleibt privat.

Ab Alpha 3 steht **Hilfe → Nach Updates suchen …** zur Verfügung. Bei Alpha 1 und Alpha 2 einmalig manuell herunterladen. Vor dem Wechsel Schreibatelier schließen und wichtige Projekte sichern. Portabel den bestehenden `Data`-Ordner und eigene Projektdateien beibehalten; beim Wechsel in einen neuen Ordner `Data` mitkopieren. Installierte Versionen verwenden weiterhin `%LocalAppData%\Schreibatelier`.

Die .NET-Laufzeit und lokale deutsche Sprachprüfung sind enthalten. Microsoft Edge WebView2 Runtime muss vorhanden sein. Pandoc und Typst für erweiterte Import-/Exportformate werden separat eingerichtet; Anleitung und Skripte liegen bei.

## Grenzen und Prüfung

**Frühe, nicht digital signierte Testversion.** SHA-256 prüft die Dateiintegrität, keine Herausgebersignatur. Das Netz zeigt einen Beziehungsstand ohne zeitlichen Verlauf. Sehr dichte Netze können trotz getrennter Beschriftungen unübersichtlich werden; Suche, Nachbarschaftsfilter, Zoom und die Beziehungsliste bieten weitere Zugänge. In schmalen Fenstern verwendet die Anwendung ein überlagerndes Notizbuch.

Die Anleitung im Paket unter `docs/BEZIEHUNGSNETZ.md` enthält einen Beispielablauf mit Mara, Jonas, Hafenstadt und Kompass. Nachweise und die getrennt dokumentierten früheren Paketprüfungen stehen in `docs/VALIDIERUNG.md`.

Windows-Release-Build, TypeScript-Prüfung, 23 JavaScript-Logiktests, 194 Core-/Konverterprüfungen, acht Prüfungen der lokalen Sprachprüfung, 15 Updateprüfungen und alle 47 Edge-Oberflächentests bestanden. Das Lizenzinventar bestätigt weiterhin 71 Komponenten. Die endgültigen Pakete enthalten dieselben nativ geprüften Programmdateien und die abschließenden Begleitdokumente.

LanguageTool Premium ist weiterhin nicht mit einem echten Premium-Konto abgenommen; Claude-Abos sind nicht angebunden. Eine Installation auf einem zweiten Rechner und längere Alltagsnutzung wurden für diesen Ausbau nicht geprüft.
