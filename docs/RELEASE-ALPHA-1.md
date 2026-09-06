# Schreibatelier – Alpha 1

Version **0.1.0-alpha.1**, Tag **v0.1.0-alpha.1**. Frühe Vorabversion für Windows x64.

## Downloads

- **Schreibatelier-0.1.0-alpha.1-Setup-win-x64.exe**: Installer für das aktuelle Windows-Benutzerkonto mit Startmenü-Eintrag, optionaler Desktop-Verknüpfung und Deinstaller.
- **Schreibatelier-0.1.0-alpha.1-Portable-win-x64.zip**: Vollständig entpacken und `Schreibatelier.exe` starten. `portable.txt` aktiviert die Ablage von Einstellungen, Sicherungen, Vorschauen und WebView-Daten im Unterordner `Data`.
- **SHA256SUMS.txt**: SHA-256-Prüfsummen beider Downloads.

Die .NET-Laufzeit ist enthalten. Microsoft Edge **WebView2 Runtime** muss installiert sein. Falls sie fehlt, bietet die Anwendung die [offizielle Microsoft-Downloadseite](https://developer.microsoft.com/microsoft-edge/webview2/) an. **Pandoc** für erweiterte Import-/Exportformate und **Typst** für PDF werden separat eingerichtet; die Anleitung und `scripts/install-tools.ps1` liegen in beiden Paketen.

## Enthalten

Lokale Projektdateien, Kapitelstruktur, Rich-Text-Editor, Pinnwand, Gliederung, Rechercheanhänge, Textstände, Suche, Import/Export und automatische Sicherungen. Das Notizbuch lässt sich mit Maus und Tastatur in der Breite ändern; die Breite wird gespeichert. Die Anwendung zeigt die Kennzeichnung **Alpha 1** im Fenster und in der Oberfläche.

## Geprüft

Release-Build und TypeScript-Prüfung, drei Logiktests, 77 Speicher-/Exportprüfungen und acht Oberflächentests erfolgreich. Beide fertigen Pakete wurden gestartet und mit der echten Editor-/SQLite-Anbindung geprüft. Portabler Ordnerumzug erhält Einstellungen; die getestete Deinstallation erhält selbst angelegte Projekte und Benutzerdaten.

## Daten und Grenzen

Dies ist eine Testversion. Verwende Kopien deiner Manuskripte und zusätzliche Sicherungen auf einem anderen Datenträger. Funktionsumfang und bekannte Grenzen stehen in [UMFANG.md](UMFANG.md), Prüfungen in [VALIDIERUNG.md](VALIDIERUNG.md).

Die installierte Variante speichert Einstellungen und Sicherungen unter `%LocalAppData%\Schreibatelier`. Die Deinstallation entfernt die Programmdateien und Verknüpfungen; eigene Projekte und Benutzerdaten bleiben erhalten. Zum Umziehen der portablen Variante die Anwendung schließen und den gesamten Ordner einschließlich `Data` kopieren. Außerhalb des Ordners gespeicherte Projekte separat mitnehmen. Konverter verwenden weiterhin temporäre Dateien im Windows-Temp-Ordner.

**Nicht digital signiert.** Eine Prüfung auf einem zweiten Rechner, Langzeittests und eine uneingeschränkte Kompatibilität mit fremden Office-Dokumenten sind nicht bestätigt. Es gibt keinen automatischen Updater. Das Repository und die Release-Downloads bleiben privat; die vorhandene Projektlizenz gilt weiter.
