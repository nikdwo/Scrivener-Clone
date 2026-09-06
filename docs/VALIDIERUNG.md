# Validierung – Alpha 2 (0.1.0-alpha.2)

Prüfrechner: Windows x64, Build 26200, .NET SDK 10.0.400 / Runtime 10.0.11, Microsoft Edge WebView2 Runtime 152.0.4191.62. Native Laufzeit und Browsermodell wurden getrennt geprüft. Die Ergebnisse beziehen sich auf diesen Rechner und die mitgelieferten Testfälle.

## Alpha-2-Prüfungen, 6. September 2026

Nach der Zusammenführung wurden die TypeScript-Prüfung, vier JavaScript-Logiktests, 77 Speicher-/Konverterprüfungen, acht Prüfungen der lokalen Sprachprüfung und 13 Edge-Oberflächentests erfolgreich ausgeführt. Die Oberflächentests schließen den Abbruch des Kontodialogs mit leeren oder ungültigen Pflichtfeldern ein. Die Sprachprüfungsanbindung einschließlich der bereits erfolgreich getesteten ChatGPT-Korrektur bleibt bei der Zusammenführung unverändert.

Die Paketprüfung kontrolliert für Alpha 2 zusätzlich die echte lokale Sprachprüfung bis zum gespeicherten Korrekturvorschlag und Undo sowie die mitgelieferten Herkunftsnachweise. Ihre Ergebnisse werden unter `artifacts/alpha2-release-checks.log` abgelegt.

## Alpha-1-Veröffentlichung, 6. September 2026

TypeScript-Prüfung und Release-Build erfolgreich; drei JavaScript-Logiktests, 77 Speicher-/Konverterprüfungen und acht Edge-Oberflächentests bestanden. Die Alpha-Kennzeichnung wurde auch in einer Aufnahme der echten Windows-Anwendung geprüft.

`scripts/test-release.ps1` prüft die SHA-256-Werte und testet die ausgelieferten Pakete in einem neuen Unterordner von `.work/release-check/`: portables ZIP entpacken, native Editor-Bridge bis SQLite, Einstellungen/Backups/WebView-Daten im lokalen `Data`-Ordner, erneuter Start nach einem Ordnerumzug mit erhaltenen Einstellungen, tatsächliche Installer-Ausführung, Start der installierten Anwendung und Deinstallation. Die Deinstallation entfernte Programmdateien und Registrierung; selbst angelegte Projektdateien und Benutzerdaten blieben erhalten. Alle diese Prüfungen bestanden. Die installierte Anwendung verwendet für den nativen Test einen isolierten Datenordner; vorhandene Benutzereinstellungen werden dabei nicht angefasst.

Installer mit Inno Setup 7.1.0 x64 gebaut. Der Compiler-Download wurde gegen SHA-256 `0362a383ed217d4c4239b5933866dd96d3eb2102737da92f80f6057a4b40df2f` und eine gültige Authenticode-Signatur von Pyrsys B.V. geprüft. Die eigenen Anwendungspakete sind **nicht signiert**. Die Paketprüfung erfolgt auf demselben Rechner; ein zweiter Rechner und die Installation einer fehlenden WebView2 Runtime wurden nicht geprüft.

## Automatische Prüfungen

`tests/Schreibatelier.Checks` prüft die echte SQLite-Speicherung und startet die tatsächlich installierten Konverter. Erfasste Fälle:

- Neueröffnung, Revisionen, atomarer Rollback bei Konflikten, Hierarchie, Papierkorb, Textstände und Wiederherstellung.
- Zweite Instanz schreibgeschützt, schreibgeschützte Datei, unveränderte Originaldatei bei ungültigem Format, beschädigte Datei und beschädigte Hierarchie.
- Abgelehnte lokale Bild-/JavaScript-Referenzen und Projektkennungen mit Pfadwechseln.
- Atomisches Teilen/Zusammenführen, importierte Stapel und gesicherte projektweite Ersetzung.
- Alle elf Ausgabeformate; Text-Rundläufe für DOCX/RTF/ODT/HTML/Markdown; Fußnoten für DOCX/ODT/Markdown; Endnoten und Kommentar-Anhang in HTML.
- Bilder in HTML, Markdown, LaTeX, DOCX, ODT, PDF und EPUB; eingebettete Bilder beim DOCX-/ODT-Rundlauf; Begleitbilder bleiben nach Löschen des Konverter-Arbeitsordners vorhanden.
- Fehlender Konverter und ein als Ausgabeziel ausgewähltes Projekt beschädigen keine vorhandenen Dateien.
- Fountain-Rundlauf einschließlich Leerzeilen, Leerzeichen, Notizen und Markern für gleichzeitige Dialoge.
- Eigens gestarteten Schreibprozess während einer offenen SQLite-Transaktion hart beendet: der bestätigte vorherige Text bleibt erhalten, die unbestätigte Transaktion wird beim Wiederöffnen zurückgerollt.

Der Prüfdatensatz mit **1.000 Abschnitten / 500.000 Wörtern** benötigte in einem gemessenen Lauf 361 ms für den transaktionalen Import, 12 ms für die Projektzusammenfassungen und 12 ms für die auf 500 Treffer begrenzte Suche. Das sind Einzelmessungen, keine allgemeine Leistungsgarantie. Der Test prüft außerdem, dass die Projektübersicht keine vollständigen Abschnittstexte mitlädt.

`tests/web.test.mjs` prüft Baumreihenfolge/Zyklenschutz, Unicode-Statistik ohne Fußnoten, Sammlungen/HTML-Escaping sowie die Textaufteilung und Positionszuordnung der Sprachprüfung einschließlich Emoji und Fußnoten-Barrieren.

`tests/ui/editor.spec.ts` prüft mit einer Test-Bridge in echtem Edge:

1. Schreiben, Formatieren, wiederholtes Speichern, tatsächlich erfolgter Abschnittswechsel und erhaltene Fußnoten.
2. Speicherfehler: Text bleibt im Editor, Navigation wird blockiert, erneuter Versuch funktioniert.
3. Eingabe während eines ausstehenden Speichervorgangs wird nicht durch dessen Antwort überschrieben.
4. Pinnwand, Gliederung, Metadaten, Farbschema und Fokus verwenden dasselbe Projekt.
5. Screenshots für hell/dunkel/Pinnwand und ein kompaktes Fenster mit 960 × 540 CSS-Pixeln ohne Seitenüberlauf.
6. Projektweites Ersetzen über unterschiedliche Textformatierung hinweg mit vorherigen Textständen.
7. Schriftgestaltung, Bearbeiten von Fußnoten und Wiederverwendung einer eigenen Vorlage.
8. Breitenverstellung des Notizbuchs mit Maus und Tastatur, Speicherung und Anpassung an kleinere Fenster.
9. Sprachprüfung: korrekte Fundstellen, erhaltene Formatierung und Fußnoten, Rückgängig und verworfene veraltete Ergebnisse.
10. Projektwörterbuch, gezieltes Senden nur der Markierung, Sprach- und tatsächliche Modellauswahl, automatische lokale Prüfung und Schreibschutz. Die Online-Antworten kommen hier aus der Test-Bridge; das ist keine bestätigte Anbieterprüfung.

`tests/Schreibatelier.ProofChecks` prüft zusätzlich die echte lokale LanguageTool-Engine mit einem deutschen Rechtschreib- und Grammatikfehler sowie Aufträgen für Deutschland, Österreich und die Schweiz. Die Parserprüfungen kontrollieren UTF-16-Offsets und lehnen erfundene oder uneindeutige KI-Originalstellen ab. Mit `--codex` wird außerdem der echte Codex App Server gestartet und der Kontostatus eines eigenen Testprofils abgefragt.

Der ausdrücklich zu wählende Modus `--codex-live` verwendet die vorhandene ChatGPT-Anmeldung von Schreibatelier und sendet ausschließlich einen fest eingebauten Prüfsatz. Am 6. September 2026 wurden mit Codex CLI 0.147.0 und dem tatsächlich angebotenen GPT-5.6-Sol eine Rechtschreibkorrektur (`Feler` → `Fehler`) und eine Grammatikkorrektur (`ein Apfel` → `einen Apfel`) bestätigt. Der Produktionscode verlangt vor dem Senden des Texts die Bestätigung des beschränkten Berechtigungsprofils. Eine LanguageTool-Premium-Prüfung mit Benutzerkonto steht noch aus.

Die Browsertests laufen außerhalb der restriktiven Agent-Sandbox: darin wurden Testprozesse zwar ausgeführt, aber das Beenden des Testservers funktionierte nicht zuverlässig. Die uneingeschränkte Prüfung beendet sich regulär mit dem Testergebnis. Dies betrifft die Testumgebung, nicht eine Administratoranforderung der Anwendung.

## Echte Windows-Anwendung

Der Modus `--integration-test <Testprojekt.schreibprojekt>` startet WPF + WebView2, erstellt einen Testabschnitt, schreibt Rich Text/Fußnote durch die echte Bridge in SQLite und liest ihn erneut aus. Anschließend prüft die echte lokale LanguageTool-Engine den Text; eine Korrektur wird übernommen, in SQLite gelesen und rückgängig gemacht. Außerdem werden Pinnwand und vorhandene Rechercheansichten aufgerufen. Er ist nur auf die eigens angelegte Testdatei anzuwenden.

`result.json` und native WebView2-Bildaufnahmen liegen nach dieser Prüfung unter `.work/app-test`. Die PDF-Aufnahme zeigte den integrierten PDF-Betrachter mit tatsächlich gerendertem Inhalt. Die HTML-Aufnahme zeigte den statischen Recherchetext; das absichtlich eingebaute Skript, das den Seiteninhalt ersetzen sollte, wurde nicht ausgeführt. Die helle und dunkle Editoroberfläche wurde visuell geprüft.

## Aussagegrenzen

Die Tests sind kein Ersatz für die Abnahme mit eigenen Manuskripten. Nicht geprüft sind Stromausfall, defekte Hardware, alle Fremddokumentvarianten, sämtliche Windows-Mediencodecs, längere tägliche Nutzung und ein zweiter Rechner. Der Test mit kleinem Fenster ist keine bestätigte Prüfung sämtlicher Windows-DPI-Einstellungen. Das Paket ist nicht signiert; Signatur und Smart-App-Control-Akzeptanz wurden nicht als bestanden behauptet.

Die tatsächlich ausgeführten letzten Prüfungen und Paketprüfsummen werden zusätzlich in `artifacts` abgelegt. Lizenzinventar und Originaltexte sind vorhanden; eine anwaltliche Freigabe wurde nicht durchgeführt.
