# Schreibatelier – Alpha 2

Version **0.1.0-alpha.2**, Tag **v0.1.0-alpha.2**. Vorabversion für Windows x64.

## Neu gegenüber Alpha 1

- Deutsche Rechtschreib- und Grammatikprüfung mit mitgelieferter lokaler LanguageTool-Engine und Java-Laufzeit; Deutsch für Deutschland, Österreich und die Schweiz.
- Gemeinsame Prüfansicht im Notizbuch: Abschnitt oder Markierung prüfen, Fundstellen anzeigen, einzelne Korrekturen übernehmen, Undo und Projektwörterbuch. Automatische lokale Prüfung und Stilhinweise sind optional.
- Optional LanguageTool Premium über E-Mail und Zugriffsschlüssel sowie ChatGPT-Abo über die separat installierte Codex CLI. Die KI-Modellauswahl stammt aus dem verbundenen Konto. Online-Prüfungen starten ausdrücklich und zeigen den zu sendenden Textumfang.
- Korrigierter Abbrechen-Knopf im Kontodialog und aktualisierte Codex-Berechtigungen für die ChatGPT-Prüfung.

## Downloads und Start

- **Schreibatelier-0.1.0-alpha.2-Setup-win-x64.exe**: Installation für das Windows-Benutzerkonto, Startmenü-Eintrag, optionale Desktop-Verknüpfung und Deinstaller.
- **Schreibatelier-0.1.0-alpha.2-Portable-win-x64.zip**: Vollständig in einen beschreibbaren Ordner entpacken und **Schreibatelier.exe** starten. Einstellungen, Sicherungen und Anbieterzugänge liegen unter `Data` neben der EXE.
- **SHA256SUMS.txt**: SHA-256-Prüfsummen beider Downloads.

Die .NET-Laufzeit und die lokale Sprachprüfung sind enthalten. Microsoft Edge WebView2 Runtime muss vorhanden sein. Pandoc und Typst für erweiterte Import-/Exportformate werden separat eingerichtet; die Anleitung und Einrichtungsskripte liegen bei.

Für die Sprachprüfung einen Textabschnitt öffnen und **Prüfen → Prüfverfahren** wählen. Die lokale Prüfung benötigt kein Konto. Details: [Sprachprüfung](SPRACHPRUEFUNG.md).

## Daten und Grenzen

Die installierte Variante verwendet weiterhin den vorhandenen Schreibatelier-Datenordner im Windows-Benutzerprofil. Eigene Projekte und Benutzerdaten werden bei der Deinstallation erhalten. Beim Umzug der portablen Variante die Anwendung schließen und den gesamten Ordner einschließlich `Data` mitnehmen; außerhalb gespeicherte Projekte separat kopieren. Online-Zugänge bei einem Rechner- oder Benutzerwechsel erneut verbinden.

Die ChatGPT-Anbindung wurde mit einem verbundenen Konto und GPT-5.6-Sol an einem deutschen Rechtschreib- und Grammatikbeispiel erfolgreich getestet. Die LanguageTool-Premium-Prüfung mit einem Benutzerkonto steht noch aus. Claude-Abos sind nicht angebunden. Weitere Prüfungen und Grenzen: [Validierung](VALIDIERUNG.md), [Funktionsumfang](UMFANG.md).

Für den zusammengeführten Stand bestanden die TypeScript-Prüfung, vier Logiktests, 77 Speicher-/Exportprüfungen, acht lokale Sprachprüfungen und 13 Edge-Oberflächentests.

**Frühe, nicht digital signierte Testversion.** Verwende Kopien wichtiger Manuskripte und zusätzliche Sicherungen. Ein zweiter Rechner und längere tägliche Nutzung wurden noch nicht geprüft. Das Repository und die Release-Downloads bleiben privat.
