# Schreibatelier – Alpha 4

Version **0.1.0-alpha.4**, Tag **v0.1.0-alpha.4**. Vorabversion für Windows x64.

**Prüfvorbehalt:** Auf dem Prüfrechner blockierte die Windows-Anwendungssteuerung den portablen Programmstart und den internen Installerprozess wegen der Signaturanforderungen. Nativer Start, Installation und Deinstallation der Alpha-4-Pakete sind dort deshalb nicht bestätigt. Die Sicherheitsrichtlinien wurden nicht geändert.

## Neu gegenüber Alpha 3

- **Figuren, Orte und Gegenstände** bekommen eigene Karten mit Namen, alternativen Namen, passenden Textfeldern und frei benannten Zusatzfeldern. Links stehen sie in einem eigenen Bereich außerhalb der Recherche. Karten lassen sich über die Seitenleiste, das Notizbuch oder die Vorlagen anlegen.
- Namen und alternative Namen werden lokal im Manuskript erkannt, auch über Formatierungswechsel hinweg. Ein Klick öffnet die Karte rechts, während der Abschnitt geöffnet bleibt. Wortgrenzen, längere Namen und mehrdeutige Treffer werden berücksichtigt. Die Erkennung lässt sich projektweit abschalten.
- Karten können mehreren Szenen zugeordnet werden; jede Karte zeigt ihre zugeordneten Abschnitte. Bewusste Textverweise öffnen ebenfalls das Notizbuch. Exportierte Manuskripte enthalten normalen Text ohne automatische Markierungen oder tote Kartenlinks.
- **Rechtsklick → In den Papierkorb verschieben** funktioniert für Abschnitte, Ordner, Rechercheeinträge sowie alle drei Kartentypen. **Umschalt+F10** öffnet dasselbe Menü per Tastatur. Vor dem Verschieben werden offene Änderungen gespeichert. Im Papierkorb bleiben die Einträge einschließlich Kartenfeldern und Zuordnungen wiederherstellbar.
- Automatisches Speichern, Schreibschutz, Sicherungen und bestehende Sprachprüfungen bleiben integriert. Teile, Duplikate und zusammengeführte Szenen behalten ihre Kartenbezüge.

## Downloads und Aktualisieren

- **Schreibatelier-0.1.0-alpha.4-Setup-win-x64.exe**: Windows-Installer für das Benutzerkonto.
- **Schreibatelier-0.1.0-alpha.4-Portable-win-x64.zip**: vollständig entpacken und `Schreibatelier.exe` starten.
- **SHA256SUMS.txt**: Prüfsummen beider Pakete.

[Öffentliche Downloads](https://github.com/nikdwo/Schreibatelier-Releases/releases/tag/v0.1.0-alpha.4). Der Quellcode bleibt privat.

Ab Alpha 3 steht **Hilfe → Nach Updates suchen …** zur Verfügung. Bei Alpha 1 und Alpha 2 die neue Version einmalig manuell herunterladen. Vor dem Wechsel Schreibatelier schließen und wichtige Projekte sichern. Portabel den bestehenden `Data`-Ordner und eigene Projektdateien beibehalten; beim Wechsel in einen neuen Ordner `Data` mitkopieren. Installierte Versionen verwenden weiterhin `%LocalAppData%\Schreibatelier`.

Die .NET-Laufzeit und lokale deutsche Sprachprüfung sind enthalten. Microsoft Edge WebView2 Runtime muss vorhanden sein. Pandoc und Typst für erweiterte Import-/Exportformate werden separat eingerichtet; Anleitung und Skripte liegen bei.

## Grenzen und Prüfung

**Frühe, nicht digital signierte Testversion.** SHA-256 prüft die Dateiintegrität, keine Herausgebersignatur. Die Namenssuche arbeitet exakt und beachtet Groß-/Kleinschreibung; Pronomen, Fußnoten, Codeblöcke und bereits verlinkte Textstellen werden nicht automatisch erkannt. Bildsteckbriefe, Zeitstrahl, Beziehungsdiagramme und KI-Auswertung der Karten sind nicht enthalten.

LanguageTool Premium ist weiterhin nicht mit einem echten Premium-Konto abgenommen; Claude-Abos sind nicht angebunden. Die Nachweise für Builds, Oberfläche, Speicherung und die fertigen Pakete stehen in der mitgelieferten Datei `docs/VALIDIERUNG.md`. Ein zweiter Rechner und längere tägliche Nutzung wurden nicht geprüft.

Release-Build, TypeScript-Prüfung, sechs JavaScript-Logiktests, 33 Kartenprüfungen, 83 weitere Speicher-/Konverterprüfungen, acht Prüfungen der lokalen Sprachprüfung sowie alle 27 Edge-Oberflächentests bestanden. Das Lizenzinventar bestätigt 71 Komponenten. Die Paketprüfsummen und Inhalte wurden kontrolliert; die native Paketprüfung bleibt durch die oben genannte Windows-Richtlinie eingeschränkt.
