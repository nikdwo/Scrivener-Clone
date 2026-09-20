# Szenen-Zeitstrahl – Alpha 5

Der Zeitstrahl gehört zu Alpha 5. Er arbeitet lokal, ohne Konto oder Netzwerk. Die Stilanalyse bleibt enthalten.

Die zusätzliche **Testversion Schreibansicht & Zeitstrahl** auf `testing` ergänzt Verschieben und Größenänderung mit Maus und Tastatur. Die Anleitung steht in [TESTVERSION-BEDIENUNG.md](TESTVERSION-BEDIENUNG.md). Die unten beschriebenen Grenzen beziehen sich auf den ursprünglichen Veröffentlichungsumfang.

## Starten und einrichten

Alpha 5 installieren und **Schreibatelier Alpha 5** im Startmenü öffnen oder das portable ZIP vollständig entpacken und `Schreibatelier.exe` starten. Im Quellprojekt öffnet **Schreibatelier starten** nach dem Release-Build `artifacts/Schreibatelier-0.1.0-alpha.5/app/Schreibatelier.exe`.

1. Projekt öffnen und **Zeitstrahl** neben Text, Pinnwand und Gliederung wählen. Alternativ: **Ansicht → Zeitstrahl**.
2. **Zeitstrahl einrichten** wählen. Relative Tage sind vorausgewählt; alternativ stehen Kalenderdaten zur Verfügung. Diese Wahl gilt anschließend dauerhaft für das Projekt. Eine spätere Umrechnung ist nicht enthalten.
3. Eine Szene auswählen. Rechts unter **Details → Zeit & Handlung** Beginn, optionales Ende und Handlungsstrang eintragen. **Handlungsstrang anlegen** erstellt eine neue Bahn; anschließend diese im Auswahlfeld zuordnen.
4. **Text öffnen** wechselt zum Schreiben. Bei der Rückkehr zum Zeitstrahl bleiben Filter, Zoom und Ausschnitt für dieses geöffnete Projekt erhalten.

## Beispiel mit drei Szenen

Ein neues Projekt mit relativen Tagen und zwei Handlungssträngen **Heimkehr** und **Die Suche** einrichten. Drei Textabschnitte unter Manuskript anlegen:

| Szene | Handlung | Beginn | Ende |
|---|---|---|---|
| Mara kehrt zurück | Heimkehr | Tag 1, 09:00 | Tag 1, 13:00 |
| Die Suche beginnt | Die Suche | Tag 1, 10:00 | Tag 1, 14:00 |
| Der folgende Tag | Heimkehr | Tag 2, ohne Uhrzeit | leer |

Unter **Figuren, Orte & Gegenstände** eine Figur **Mara** anlegen und ausdrücklich den ersten beiden Szenen zuordnen. Im Zeitstrahl **Figur → Mara** wählen: Jetzt erscheinen diese zwei Szenen. Ihre Balken überschneiden sich zeitlich. Nach Speichern und Programmneustart müssen Zeiten und Zuordnungen weiterhin vorhanden sein.

## Darstellung und Bedienung

- Der Zeitstrahl zeigt alle lebenden Text- und Drehbuchabschnitte im Manuskript, unabhängig vom links ausgewählten Kapitel. Recherche, Karten und Ordner sind keine Ereignisse.
- Eine Szene gehört höchstens einer Handlung an. Stränge können über **Handlungsstränge** umbenannt werden. Vor dem Löschen müssen alle Szenenzuordnungen entfernt sein, auch im Papierkorb.
- Ein Beginn ohne Ende ist ein Ereignismarker. Beginn und Ende ergeben einen Balken. Gestrichelte Bereiche kennzeichnen einen ganzen Tag, dessen genaue Uhrzeit offenbleibt. Die Uhrzeiten an der Achse sind Orientierungspunkte und keine ergänzten Szenenzeiten.
- Überlappende Balken und Beschriftungen erhalten getrennte Unterzeilen. Die Manuskriptreihenfolge entscheidet bei gleichen Beginnangaben über die Reihenfolge.
- **Gesamtansicht**, **Vergrößern**, **Verkleinern** und horizontales Scrollen verändern nur die Darstellung. Bei schmalen Fenstern bleibt die Achse scrollbar. Titel und Zeiten stehen auf den Szenenknöpfen; der vollständige Text ist zusätzlich als Tooltip verfügbar.
- **Noch nicht zeitlich eingeordnet** enthält Szenen ohne Beginn. **Ohne Handlungsstrang** enthält zeitlich eingeordnete Szenen ohne Handlung.
- Handlungsstrang, Figur, Ort und Gegenstand können gemeinsam gefiltert werden. Es gelten ausschließlich gespeicherte Kartenzuordnungen, keine automatischen Namenstreffer. Ein Projektwechsel setzt Ansichtsauswahl, Filter und Ausschnitt zurück.
- Alle Knöpfe und Felder sind per Tab erreichbar. Eingabetaste beziehungsweise Leertaste wählt eine Szene; die fokussierte Zeitachse lässt sich mit den Pfeiltasten scrollen. Das Kontextmenü einer Szene bietet den vorhandenen Papierkorb.

## Zeitregeln und Datenerhalt

Relative Tage sind ganze Zahlen im 32-Bit-Bereich, einschließlich 0 und negativer Tage. Kalenderdaten reichen von 01.01.0001 bis 31.12.9999. Uhrzeiten verwenden `HH:mm`, 00:00 bis 23:59. Es findet keine Zeitzonen- oder Sommerzeitumrechnung statt. Ein Ende ohne Beginn oder ein eindeutig früheres Ende wird abgewiesen. Tagesgenaue Angaben beschreiben den möglichen Bereich 00:00–23:59, ohne eine konkrete Uhrzeit zu speichern oder an der Szene vorzugeben.

Zeitdaten liegen in `meta.timeline` (`start`/`end` mit `day` und optional `time`, optional `strandId`). `day` ist je nach Projektbasis eine ganze Zahl oder ein ISO-Datum. `settings.timeline` speichert `basis` (`relative`/`calendar`) und `strands` mit stabilen IDs und Namen. Bestehende Projekte benötigen keine Datenbankmigration.

Zeitänderungen verwenden dieselbe automatische Speicherung wie Manuskriptänderungen. Feldfehler stehen direkt unter den Zeitangaben und müssen vor einem Szenen-, Ansichts- oder Projektwechsel korrigiert werden. Bei Speicherfehlern bleiben Eingaben erhalten. Schreibgeschützte Projekte erlauben Ansicht und Navigation, keine Änderungen.

Duplizieren und Teilen kopieren Zeiten und Handlung unverändert; es wird kein zeitlicher Schnittpunkt geschätzt. Zusammenführen behält die Angaben des ersten Abschnitts. Die Angaben des zweiten bleiben in seinen Textständen und im Papierkorb. Papierkorb und Wiederherstellung erhalten alle Zeitdaten. Ein aus einem Textstand wiederhergestellter, inzwischen gelöschter Handlungsstrang wird als nicht verfügbar angezeigt und kann neu zugeordnet werden.

Der Zeitstrahl verändert weder Manuskripttext noch Reihenfolge, Textrückgängigverlauf oder Manuskriptexport. Ziehen von Ereignissen, Tageszeiten wie „morgens“, Kalenderumrechnung, eigene Kalendersysteme und automatische Logikwarnungen gehören nicht zu dieser Version.
