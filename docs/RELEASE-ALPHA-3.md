# Schreibatelier – Alpha 3

Version **0.1.0-alpha.3**, Tag **v0.1.0-alpha.3**. Vorabversion für Windows x64.

## Neu gegenüber Alpha 2

- **Hilfe → Nach Updates suchen …**: öffentliche GitHub-Downloads ohne Anmeldung und ohne eigenen Server. Die Prüfung beim Programmstart lässt sich abschalten. Alpha-Versionen berücksichtigen auch neue Vorabversionen.
- Downloads werden auf Größe und SHA-256 geprüft. Der Installer wird erst nach Klick, erfolgreichem Speichern und einer Projektsicherung gestartet. Bei Fehlern bleibt Schreibatelier geöffnet. Portable ZIPs werden geprüft heruntergeladen und anschließend manuell unter Erhalt von `Data` entpackt.
- Die Startseite zeigt die letzten drei geöffneten Projekte mit Name, Speicherort und direktem Zugriff.
- Kurzanleitung und Lizenzdialog haben nur noch eine eindeutige Schließen-Aktion. Bearbeitungs- und Kontodialoge behalten Abbrechen.
- Die lokale deutsche Sprachprüfung sowie LanguageTool-Premium- und ChatGPT-Anbindung aus Alpha 2 bleiben enthalten.

## Downloads und erster Wechsel

- **Schreibatelier-0.1.0-alpha.3-Setup-win-x64.exe**: Windows-Installer für das Benutzerkonto.
- **Schreibatelier-0.1.0-alpha.3-Portable-win-x64.zip**: vollständig entpacken und `Schreibatelier.exe` starten.
- **SHA256SUMS.txt**: Prüfsummen beider Pakete.

Öffentliche Downloads: https://github.com/nikdwo/Schreibatelier-Releases/releases/tag/v0.1.0-alpha.3

Die veröffentlichten Alpha-1-/Alpha-2-Pakete besitzen noch keinen Updater. **Einmalig Alpha 3 manuell installieren bzw. entpacken**; spätere Veröffentlichungen können innerhalb der Anwendung angeboten werden. Die öffentliche Downloadquelle enthält nur Pakete und Versionshinweise. Der Quellcode bleibt privat.

Die .NET-Laufzeit und lokale Sprachprüfung sind enthalten. Microsoft Edge WebView2 Runtime muss vorhanden sein. Pandoc und Typst für erweiterte Import-/Exportformate werden separat eingerichtet; die Anleitung und Skripte liegen bei.

## Daten und Grenzen

Vor einem Wechsel die Anwendung schließen und wichtige Manuskripte zusätzlich sichern. Installierte Versionen verwenden weiterhin `%LocalAppData%\Schreibatelier`. Portabel den bestehenden `Data`-Ordner und eigene Projektdateien beibehalten; beim Wechsel in einen neuen Ordner `Data` bei geschlossener Anwendung mitkopieren. Außerhalb gespeicherte Manuskripte bleiben an ihrem bisherigen Speicherort.

**Frühe, nicht digital signierte Testversion.** SHA-256 bestätigt die Dateiintegrität, keine Herausgebersignatur. **Windows-Anwendungssteuerung hat den Alpha-3-Installer auf dem Prüfrechner blockiert; Installation und Deinstallation dieser Version sind dort noch nicht bestätigt.** Das portable Paket wurde erfolgreich gestartet und einschließlich Speicherung, lokaler Sprachprüfung und Ordnerumzug geprüft. Ein zweiter Rechner und längere tägliche Nutzung wurden noch nicht geprüft. LanguageTool Premium ist weiterhin nicht mit einem echten Premium-Konto abgenommen; Claude-Abos sind nicht angebunden.

Release-Build, TypeScript-Prüfung, 71-Komponenten-Lizenzinventar, vier JavaScript-Logiktests und alle 17 Edge-Oberflächentests bestanden. Der erneute Lauf der separaten .NET-Konsolenprüfungen wurde durch eine Windows-Blockierung der Test-DLL verhindert. Frühere erfolgreiche Prüfungen werden deshalb nicht als neue Alpha-3-Ergebnisse ausgegeben. Weitere Prüfabläufe stehen in den mitgelieferten Dateien `docs/VALIDIERUNG.md` und `docs/SPRACHPRUEFUNG.md`.
