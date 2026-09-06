# Validierung – Alpha 4 (0.1.0-alpha.4)

Prüfrechner: Windows x64, Build 26200, .NET SDK 10.0.400 / Runtime 10.0.11, Microsoft Edge WebView2 Runtime 152.0.4191.62. Native Laufzeit und Browsermodell wurden getrennt geprüft. Die Ergebnisse beziehen sich auf diesen Rechner und die mitgelieferten Testfälle.

## Zeitstrahl auf testing, 6. September 2026

Ausgangspunkt ist der Stilanalyse-Commit `875c967` auf `testing`. Der Zeitstrahl wurde als Testbuild `0.1.0-alpha.4+testing.timeline` erstellt; Alpha-4-Veröffentlichung und `main` wurden nicht verändert. Die Projektverknüpfung **Schreibatelier starten** führt zu `artifacts/Schreibatelier-testing-timeline/app/Schreibatelier.exe`, mit Beschreibung und Fensterzusatz **Testversion Zeitstrahl**. Bedienung und Beispielablauf: [ZEITSTRAHL.md](ZEITSTRAHL.md).

- TypeScript-Prüfung und Windows-Testbuild bestanden. Lizenzinventar: weiterhin 71 Komponenten, keine zusätzliche Abhängigkeit; npm meldete keine bekannten Schwachstellen. Protokoll: `artifacts/timeline-build.log`. Die zuletzt angepasste Weboberfläche wurde separat gebaut und in denselben Testbuild übernommen; der Datei-Abgleich steht in `artifacts/timeline-build-verification.json`.
- Alle 19 JavaScript-Logiktests bestanden, darunter vier Zeitstrahltests für Kalenderdaten, Schaltjahre, Kalendergrenzen, negative Tage, Uhrzeiten, Genauigkeit, gültige Zeitreihenfolge, Filter, stabile Szenenreihenfolge, Unterzeilen für Überlappungen sowie 1.000 zeitlich weit auseinanderliegende Szenen. Protokoll: `artifacts/timeline-logic.log`.
- Alle 161 Core-/Konverterprüfungen bestanden: 34 neue Zeitstrahlprüfungen, 33 Kartenprüfungen und 94 bestehende Prüfungen. Geprüft wurden insbesondere feste Zeitbasis, Validierung auf den Schreibwegen, Revisionskonflikte, schreibgeschütztes Lesen, Papierkorb, Teilen, Zusammenführen, Kopieren, Textstände, fehlende Strangverweise nach Wiederherstellung, Neustart und unveränderter Manuskriptexport. Protokoll: `artifacts/timeline-core.log`.
- Die vollständige Edge-Testreihe umfasst 39 erfolgreiche Tests, davon sechs neue Zeitstrahlfälle. Sie prüft Einrichtung, Strangverwaltung, Zeitbearbeitung, Persistenz, Navigation, kombinierte Filter, Zoom/Ausschnitt, ungültige Eingaben, Speicherfehler, Schreibschutz, Projektwechsel und 1.000 Szenen. Ein während der Einstellungsspeicherung geänderter Szenenwert bleibt erhalten; verspätete Einstellungen werden keinem anderen Projekt zugeordnet. Protokoll: `artifacts/timeline-ui-final.json`.
- Helles und dunkles Design sowie das schmale Notizbuch wurden anhand der Aufnahmen `artifacts/timeline-light.png` und `artifacts/timeline-dark.png` kontrolliert. Die echte Windows-Aufnahme liegt unter `artifacts/timeline-native.png`.
- Der native Testbuild bestand den Ablauf mit drei Szenen, zwei Handlungen, überlappenden Zeiten, Figurenfilter, Zeitbearbeitung im Notizbuch, SQLite-Speicherung und erneutem Projektöffnen. Der vollständige Programmneustart bestätigte anschließend ausdrücklich die zuvor gespeicherten Zeiten und Handlungsstränge. Text und Manuskriptstruktur blieben im geprüften Ablauf unverändert. Auch bestehende Kartenfunktionen, Stilanalyse und die echte lokale Sprachkorrektur einschließlich Undo bestanden. Protokolle: `artifacts/timeline-native-first.json` und `artifacts/timeline-native-final.json`; getrenntes temporäres Projekt unter `.work/timeline-native/8511f03deca049d6bc24cd2796b05be0/`.

Frühe Testfehler betrafen die Testannahmen: Bei dicht liegenden Beschriftungen wird eine weitere Unterzeile benötigt; die 1.000-Szenen-Testverteilung enthielt 499 statt 500 Szenen im zweiten Strang; eine UI-Abfrage musste den abgeschlossenen Speichervorgang abwarten. Im ersten nativen Durchlauf war die wiederverwendete Testfigur auch einer anderen Prüfszene zugeordnet. Der Filter zeigte diese korrekt mit an; der abschließende Ablauf verwendet eine eigene Figur. Die obigen Ergebnisse beziehen sich auf die korrigierten abschließenden Prüfläufe. Installer, Updateinstallation und eine Veröffentlichung wurden in diesem Schritt nicht durchgeführt.

## Stilanalyse auf testing, 6. September 2026

Die lokale Stilanalyse ist als Testbuild `0.1.0-alpha.4+testing.style` unter `artifacts/Schreibatelier-testing-style/app/Schreibatelier.exe` verfügbar. `scripts/build.ps1 -Testing` baut diese Version einschließlich lokaler Sprachprüfung und aktualisiert die Projekt-Startverknüpfung, ohne Installer oder GitHub-Release zu erzeugen. Bedienung, Testtext, Regeln und vollständige Wortausnahmen stehen in [STILANALYSE.md](STILANALYSE.md).

- TypeScript-Prüfung und vollständiger Windows-Testbuild bestanden. Lizenzinventar: weiterhin 71 Komponenten; keine neue Abhängigkeit. Protokoll: `artifacts/style-build-final.log`.
- Alle 15 JavaScript-Logiktests bestanden, darunter neun Stilanalysetests zu Wortgrenzen, Unicode, Namensausnahmen, Abständen, geschützten Elementen, Satzlängen, deutschen Abkürzungen, Auswahlfragmenten, Floskeln und Abbruch. Protokoll: `artifacts/style-web-checks.log`.
- 33 Kartenprüfungen und 94 weitere Core-/Konverterprüfungen bestanden. Die elf zusätzlichen Prüfungen betreffen Standardwerte ohne Migration, SQLite-Speicherung der Stileinstellungen, Schreibschutz, ungültige Einstellungen, Erhalt des vorherigen Zustands und erneutes Öffnen einer Projektkopie. Protokoll: `artifacts/style-core-checks.log`.
- Alle 33 Edge-Oberflächentests bestanden im abschließenden Gesamtlauf ohne Fehler, Wiederholung oder ausgelassene Tests. Die sechs Stilanalysefälle prüfen alle Kategorien, Satzübersicht, kurze Vorschauen für lange Sätze, Navigation ohne Änderung des Prüfumfangs, optionale Automatik, Speicherung über erneutes Laden, Schreibschutz, Speicherfehler, kombinierten Editor, Projektwechsel, Abbruch, Seitennavigation und aktualisierte Kartennamen. Der Test kontrolliert ausdrücklich, dass im Stilmodus keine Anbieter-/Kontoaufrufe ausgelöst werden. Ein verspäteter Einstellungsauftrag kann weder Titel noch Einstellungen eines anderen Projekts überschreiben. Protokoll: `artifacts/style-ui-final.json`.
- Acht Prüfungen der echten lokalen Sprachprüfung bestanden, einschließlich Rechtschreibung, Grammatik, Deutsch DE/AT/CH, UTF-16-Positionen, Fußnoten-Barriere und KI-Antwortvalidierung. Für diesen Lauf wurden keine Texte an einen Online-Prüfanbieter gesendet. Protokoll: `artifacts/style-proof-checks.log`.
- Der native Windows-Durchlauf bestand Stilanalyse, alle drei Kategorien, direkte Navigation, unveränderten gespeicherten Text, Speicherung der Kategorieauswahl und erneutes Projektöffnen. Der finale Testbuild lud beim vollständigen Programmneustart die zuvor gespeicherten Stileinstellungen sowie Karten und Szenenzuordnungen; anschließend bestand derselbe Ablauf erneut. Auch die echte lokale Sprachkorrektur einschließlich SQLite-Speicherung und Undo blieb funktionsfähig. Protokolle: `artifacts/style-native-first.json`, `artifacts/style-native-final.json`; temporäres Projekt unter `.work/style-native/b68fc6cf60344be4a985874a33dd392c/`.
- Helles und schmales dunkles Design wurden anhand der Browseraufnahmen kontrolliert, ebenso die Aufnahme aus der echten Windows-Anwendung: `artifacts/style-analysis-light.png`, `artifacts/style-analysis-dark.png`, `artifacts/style-native.png`.

Ein Belastungsversuch mit 100.001 Zeichen und 20.000 Vorkommen eines bekannten Kartennamens in einem Absatz benötigte nach Beschleunigung der Überlappungsprüfung 67 ms in einem lokalen Node-Lauf (`artifacts/style-performance.json`). Dies ist eine Einzelmessung, keine allgemeine Laufzeitgarantie.

Ein früher Core-Versuch brach mit „Out of memory“ ab; Edge meldete beim Neuladen ebenfalls fehlende Ressourcen. Die anschließende Windows-Abfrage zeigte noch rund 1,2 GiB freien zugesicherten virtuellen Speicher bei rund 15 GiB freiem physischem Speicher. Die erfolgreichen .NET-Prüfungen wurden einzeln mit einer nur für die gestarteten Prozesse gesetzten GC-Heap-Grenze ausgeführt. Windows-Sicherheitsrichtlinien und systemweite Speichereinstellungen wurden nicht verändert. Die obigen Erfolgsangaben beziehen sich auf die abgeschlossenen Prüfläufe.

## Alpha-4-Prüfungen, 6. September 2026

**Ergänzende Anwenderprüfung:** Der Nutzer bestätigte am 6. September 2026, dass sich Alpha 4 installieren lässt und korrekt läuft. Dies ist eine Bestätigung durch den Anwender; sie ersetzt oder verändert nicht die nachstehend protokollierten automatisierten Paketversuche und bestätigt keine zusätzliche Deinstallationsprüfung.

Der vollständige Release-Build mit Versionskennung `0.1.0-alpha.4`, TypeScript-Prüfung und Lizenzinventar (71 Komponenten) bestand. Sechs JavaScript-Logiktests, 33 Kartenprüfungen, 83 weitere Speicher-/Konverterprüfungen sowie acht Prüfungen der echten lokalen Sprachprüfung bestanden. Alle 27 Edge-Oberflächentests bestanden im vollständigen Lauf, ohne Fehler, Wiederholungen oder ausgelassene Tests. Protokolle: `artifacts/alpha4-build.log`, `artifacts/alpha4-web-checks.log`, `artifacts/alpha4-core-checks.log`, `artifacts/alpha4-proof-checks.log` und `artifacts/alpha4-ui-checks.json`.

Installer und portables ZIP wurden erstellt; SHA-256, Alpha-Kennung, portabler Modus und das Fehlen von Benutzerdaten im ZIP wurden geprüft. Die Windows-Anwendungssteuerung blockierte anschließend den Start der entpackten `Schreibatelier.exe`. Beim getrennten Installertest blockierte sie den internen Setup-Prozess. Code-Integrity-Ereignisse 3033 und 3077 bestätigen für beide Dateien die nicht erfüllten Signaturanforderungen. Beide Pakete sind nicht signiert. Nativer Programmstart, Neustart/Ordnerumzug sowie Installation und Deinstallation der Alpha-4-Pakete konnten damit auf diesem Rechner nicht abgenommen werden; frühere erfolgreiche native Prüfungen werden nicht als Alpha-4-Ergebnis ausgegeben. Sicherheitsrichtlinien und Vertrauensspeicher blieben unverändert.

Die Paketversuche liegen unter `.work/release-check/97984a850bcd4e42ab9f43579c808aba` und `.work/release-check/6339c66c56334f78a0b08481585783fd`; Protokolle: `artifacts/alpha4-release-checks.log`, `artifacts/alpha4-installer-checks.log` und `artifacts/alpha4-code-integrity.log`. Es entstand keine Testinstallation. Vor dem finalen Packen wurden ausschließlich die Begleitdokumente vervollständigt; Programmdateien und Weboberfläche sind bytegleich mit dem geprüften Build. Die veröffentlichten Prüfsummen beziehen sich auf die abschließend gepackten Dateien.

Die nachstehenden Entwicklungsprüfungen dokumentieren zusätzlich die Entstehung der neuen Karten- und Papierkorbfunktionen. Sie gehören seit Alpha 4 zum veröffentlichten Umfang.

## Figuren und Orte auf testing, 6. September 2026

Die Erweiterung ist noch nicht veröffentlicht. Der lokale, selbstständige Windows-Build liegt unter `artifacts/Schreibatelier-testing/app/Schreibatelier.exe` und trägt die interne Versionskennung `0.1.0-alpha.3+testing.cards`.

- TypeScript-Prüfung und Windows-Build erfolgreich; keine zusätzlichen Abhängigkeiten.
- Fünf JavaScript-Logiktests bestanden, darunter Unicode-Positionen, alternative und mehrdeutige Namen, längste Treffer sowie Grenzen an Formatierung, Absätzen, Links, Code und eingebetteten Elementen.
- 23 neue Kartenprüfungen und die 83 bestehenden Speicher-/Konverterprüfungen bestanden. Abgedeckt sind unter anderem Wiederöffnen, Sicherung, Papierkorb, Schreibschutz, validierte Metadaten, Teilen/Zusammenführen und Export ohne Kartenlinks bei unverändertem Original.
- Alle 21 Edge-Oberflächentests bestanden im abschließenden Gesamtlauf, ohne ausgelassene, fehlgeschlagene oder instabile Tests. Die Kartenfälle prüfen Bearbeitung, eigene Felder, Szenenzuordnungen, Filter, explizite Verweise/Undo, Mehrdeutigkeit, Cursor-/Scroll-Erhalt, Speicherfehler, kombinierte Ansicht und Projektwechsel.
- Der echte Windows-Editor bestand die Speicherung von Kartenfeldern und Aliasnamen über die Bridge in SQLite, die automatische Markierung und den Erhalt der Szenenzuordnung nach erneutem Projektöffnen. Ein weiterer vollständiger Programmstart lud dieselben Karten, eigenen Felder, Aliasnamen und Zuordnungen erfolgreich. Der abschließende Build wurde ebenfalls nativ geprüft; die lokale Sprachprüfung einschließlich Korrektur/Undo bestand dabei weiterhin.

Protokolle: `artifacts/storycards-ui-checks.json`, `artifacts/storycards-core-checks.log`, `artifacts/storycards-web-checks.log` und `artifacts/storycards-native-final.json`. Ansichten: `artifacts/storycards-desktop-light.png` und `artifacts/storycards-compact-dark.png`. Native Testprojekte liegen isoliert unter `.work/storycards-native/`; vorhandene Benutzerprojekte wurden nicht verwendet. Installer und GitHub-Release wurden für diese Erweiterung nicht erstellt.

Nach der Trennung der linken Kartenlisten von Recherche bestanden vier gezielte Edge-Oberflächentests ohne Fehler oder Wiederholungen (`artifacts/storycards-sidebar-checks.json`). Geprüft wurden vorhandene und neue Karten, Umbenennen, Wiederöffnen, getrennte Rechercheansichten, einklappbare Listen, Tastaturbedienung ohne Editorwechsel, Papierkorb/Wiederherstellung, Schreibschutz und kombinierte Editoren. Die Ansicht wurde in hellem und schmalem dunklem Design kontrolliert (`artifacts/storycards-sidebar-light.png`, `artifacts/storycards-sidebar-dark.png`). TypeScript-Prüfung und vollständiger Windows-Neubuild bestanden mit null Warnungen und Fehlern; die aktualisierte Anwendung liegt wieder im oben genannten Testordner. Für diese reine Oberflächenänderung wurde kein weiterer nativer Integrationslauf ausgeführt.

## Gegenstandskarten auf testing, 6. September 2026

Gegenstände ergänzen Figuren und Orte als dritter Kartentyp. Links gibt es eine eigene Liste; Notizbuch und Vorlagen bieten **Gegenstand anlegen**. Beschreibung, Merkmale, Besitzer/Zugehörigkeit, Herkunft, Bedeutung und Notizen werden mit alternativen Namen und eigenen Feldern im bestehenden Projektformat gespeichert. Erkennung, Szenenzuordnung, Textverweise, Export und Papierkorb verwenden die gemeinsamen Kartenfunktionen.

- Sechs JavaScript-Logiktests bestanden (`artifacts/items-web-checks.log`), einschließlich Gegenstandsnamen, Aliasnamen, Teilwortgrenzen und Mehrdeutigkeit zwischen Kartentypen.
- 33 Kartenprüfungen und 83 bestehende Core-/Konverterprüfungen bestanden (`artifacts/items-core-checks.log`). Neu geprüft sind Gegenstandsfelder, ungültige Felder, Teilen/Zusammenführen mit Gegenstandszuordnungen, Export, Papierkorb und erneutes Öffnen der SQLite-Projektdatei.
- Vier gezielte Edge-Oberflächentests bestanden ohne Fehler, Wiederholungen oder ausgelassene Tests (`artifacts/items-ui-checks.json`). Sie prüfen Anlegen über Seitenleiste, Notizbuch und Vorlagen, alle Gegenstandsfelder, eigene Felder, Aliasnamen, zwei Szenenzuordnungen, Namenserkennung ohne Editorwechsel, Wiederöffnen, Papierkorb, Speicherfehler und Schreibschutz sowie die bestehenden Figuren-/Ortsabläufe.
- TypeScript-Prüfung und vollständiger Windows-Neubuild bestanden mit null Warnungen und Fehlern. Die Testversion liegt unter `artifacts/Schreibatelier-testing/app/Schreibatelier.exe`; der Projektstarter verwendet diese EXE. Helle und schmale dunkle Ansicht wurden visuell geprüft (`artifacts/items-light.png`, `artifacts/items-dark.png`). Kein zusätzlicher nativer WebView2-Durchlauf oder GitHub-Release für diese Ergänzung.

## Papierkorb per Rechtsklick auf testing, 6. September 2026

Das Kontextmenü verwendet die vorhandene Papierkorboperation für Abschnitte, Ordner mit Untereinträgen, Recherchetexte/-dateien sowie Figuren und Orte. Rechtsklick und Umschalt+F10 beziehen sich auf den angeklickten Eintrag. Vor dem Verschieben wird der Speicherpuffer geleert; bei Speicherfehlern wird nichts verschoben. Projektbereiche und schreibgeschützte Projekte bleiben geschützt. Wiederherstellen aktualisiert die Papierkorbliste und die Kartenansicht unmittelbar.

- Fünf gezielte Edge-Oberflächentests bestanden (`artifacts/context-trash-ui-checks.json`). Die drei neuen Kontextmenüfälle bestanden auch auf dem abschließenden Stand ohne Fehler, Wiederholungen oder ausgelassene Tests (`artifacts/context-trash-ui-final.json`). Geprüft: richtiges Ziel ohne Szenenwechsel, Abbrechen/Escape, Tastatur, Ordner samt Untereinträgen, Pinnwand, Figuren-/Ortsfelder und Szenenzuordnungen nach Wiederherstellung, Rechercheanhänge, Speicherfehler, Schreibschutz und Projektwechsel.
- Alle 23 Kartenprüfungen und 83 vorhandenen Core-/Konverterprüfungen bestanden, einschließlich echter SQLite-Papierkorboperationen und Wiederherstellung von Untereinträgen (`artifacts/context-trash-core-checks.log`).
- TypeScript-Prüfung, vollständiger Windows-Neubuild und Veröffentlichung im lokalen Testordner erfolgreich, null Warnungen und Fehler. Die drei ausgelieferten Webdateien stimmen per SHA-256 mit dem geprüften Build überein. Der Projektstarter verweist auf `artifacts/Schreibatelier-testing/app/Schreibatelier.exe`.
- Helles und schmales dunkles Design visuell geprüft (`artifacts/context-trash-light.png`, `artifacts/context-trash-dark.png`). Das Kontextmenü wurde in Edge geprüft; ein zusätzlicher nativer WebView2-Durchlauf wurde für diese Änderung nicht ausgeführt.

## Alpha-3-Prüfungen, 6. September 2026

Alpha 3 ergänzt die Öffnungshistorie und den GitHub-Updater. Die gezielten Prüfungen decken Versionsvergleich, Paketwahl, SHA-256, Abbruch, erneuten Download und den Schutz ungespeicherter Texte vor dem Installerstart ab. Der Release-Build einschließlich TypeScript und Lizenzinventar (71 Komponenten) sowie die vier JavaScript-Logiktests bestanden. Die aktuellen Laufprotokolle liegen unter `artifacts/alpha3-*-checks.log`; der genaue Veröffentlichungsstand steht in `RELEASE-ALPHA-3.md`.

Das portable Alpha-3-Paket bestand den nativen Start, Schreiben und Lesen über die echte Editor-Bridge in SQLite, Fußnoten, lokale Sprachprüfung mit Korrektur/Undo und den erneuten Start nach Ordnerumzug mit erhaltenen Einstellungen und Sicherungen.

Alle 17 Edge-Oberflächentests bestanden im abschließenden vollständigen Lauf. Der Test für das gezielte Senden einer Markierung setzt seine Auswahl über die Browser-Range-API und prüft sie vor dem Öffnen der Prüfansicht; die Tastatursimulation hatte im Gesamtlauf wechselnde Auswahllängen erzeugt. Exakter Textumfang, Anbieterauswahl und Sprache werden unverändert geprüft.

Windows Code Integrity blockierte den Alpha-3-Installer beim Start. Außerdem wurde `Schreibatelier.Core.dll` im separaten Debug-Testprogramm blockiert, bevor dessen Speicher-/Konverterprüfungen liefen; die nachgeschalteten Konsolenprüfungen wurden dadurch nicht ausgeführt. Der erfolgreiche native Test des portablen Release-Pakets ist davon getrennt zu betrachten. Installation und Deinstallation der Alpha 3 sind auf diesem Rechner daher nicht bestätigt. Die Sicherheitsrichtlinien wurden nicht geändert.

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
