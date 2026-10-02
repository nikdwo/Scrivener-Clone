# Schreibansicht & Zeitstrahl – Beta 1

Seit `0.2.0-beta.1` sind die auf `testing` erprobte Schreibansicht und die verbesserte Zeitstrahlbedienung im regulären Beta-Paket enthalten.

## Starten

Die installierte **Schreibatelier Beta 1** oder die vollständig entpackte portable **Schreibatelier.exe** starten. Im Quellprojekt öffnet **Schreibatelier starten.lnk** den Release-Build. Der gesamte Anwendungsordner wird benötigt. Ein separater Entwicklungsbuild bleibt mit `scripts/build.ps1 -Testing` möglich.

## Die fünf Änderungen ausprobieren

1. **Ordner und Eingabefenster:** Links **＋ Ordner** wählen, „Erstes Kapitel“ eingeben und **Enter** drücken. Im Ordner zwei Texte anlegen. Die Ordnerübersicht zeigt Namen und Einrückungen automatisch. Beim Umbenennen eines Textes aktualisiert sich auch die Übersicht. **Ordnertext** öffnet den eigenen Text des Ordners, **Zur Übersicht** führt zurück. Enter bestätigt einzeilige Eingaben; in mehrzeiligen Notizen erzeugt es weiterhin einen Zeilenumbruch. Escape, Abbrechen und × verwerfen die Eingabe.
2. **A4:** Einen längeren Text schreiben oder einfügen. Die Seiten sind A4 im Hochformat mit 25 mm Rand; der Text fließt auf weitere Seiten und beim Löschen zurück. Mit **Mit Unterabschnitten** laufen die Abschnittstexte fortlaufend über dieselben Seiten. Das Notizbuch breiter oder schmaler ziehen: Die Papieransicht skaliert, die Zeilenumbrüche bleiben erhalten. PDF und Druckvorschau verwenden weiterhin ihr eigenes Ausgabeprofil.
3. **Auswahllisten:** Dunkelmodus einschalten und eine Auswahlliste öffnen, etwa das Absatzformat oder Prüfverfahren. Die aufgeklappten Einträge haben schwarze Schrift auf hellem Hintergrund.
4. **Zeitstrahl:** Relative Tage einrichten und zwei Handlungsstränge anlegen. Eine Szene auf Tag 1, 09:00–12:00 setzen. Den Balken oder Szenenknopf mit der linken Maustaste halten und ziehen. Links/rechts verschiebt die Zeit, eine andere Bahn ändert den Handlungsstrang. Die Randgriffe ändern Beginn und Ende. Die Anzeige neben dem Mauszeiger zeigt die Position und die vorgeschlagenen Zeiten. Erst Loslassen übernimmt die Änderung; Escape bricht ab. Am sichtbaren Rand scrollt die Zeitachse weiter.
5. **Neustart:** Speichern, das Programm vollständig schließen und erneut öffnen. Ordnertexte, Namen, Szenenzeiten und Handlungsstränge müssen erhalten bleiben.

## Genauigkeit und Tastatur im Zeitstrahl

Jede Szene hat innerhalb ihres Handlungsstrangs eine eigene Zeile mit dünner Trennlinie. Die Zeilen folgen der Manuskriptreihenfolge, damit eine Zeitänderung die Szene nicht in eine andere Zeile verschiebt. Der Vorschau-Balken bleibt beim Ziehen und beim Ändern der Ränder in dieser Zeile. Beim Wechsel der Handlungsbahn erscheint dort eine eigene Vorschauzeile an der späteren Einfügeposition.

Alle Szenen und beide Randgriffe lassen sich minutengenau ziehen. **Umschalt beim Ziehen** ermöglicht Feinarbeit: Ein Mauspixel entspricht einer Minute, unabhängig vom Zoom. Ohne Umschalt folgt das Ziehen dem angezeigten Zeitmaßstab.

Bisher tagesgenaue Angaben bekommen beim Ziehen genaue Uhrzeiten. Ausgangspunkt sind die sichtbaren Grenzen: 00:00 für den Beginn und 23:59 für das Ende. Die Vorschau zeigt die neuen Zeiten; erst Loslassen übernimmt sie. Unberührte Szenen behalten ihre bisherigen Angaben.

Ein Ereignis ohne Ende kann mit einem Randgriff zu einem Zeitraum aufgezogen werden. Eine ungeplante Szene bekommt beim Ablegen auf einer Bahn einen minutengenauen Beginn ohne Ende. Für die Zuordnung zu einer anderen Bahn muss diese sichtbar sein; bei Bedarf den Handlungsstrangfilter auf **Alle** setzen.

Mit Tab einen Szenenknopf oder Randgriff erreichen. **Leertaste** startet die Verschiebung, **Links/Rechts** ändern die Zeit um eine Minute; **Umschalt + Links/Rechts** um eine Stunde. Beim Verschieben wechseln **Oben/Unten** die Bahn. **Enter** übernimmt, **Escape** bricht ab. Im Schreibschutz sind diese Änderungen gesperrt; die Ansicht und die Details bleiben zugänglich.

## Datenerhalt

Papierseiten und Ordnerübersichten werden nicht in den Manuskripttext geschrieben. Die bestehende Projektdatei und automatische Speicherung werden weiterverwendet. Bei einem Speicherfehler bleiben Änderungen im Puffer; die Fehlermeldung beachten und nach Beheben der Ursache erneut speichern. Für erste Versuche empfiehlt sich ein eigenes Testprojekt.

Automatische Prüfungen: `scripts/test.ps1`, `npm run test:ui`. Der zusätzliche native Durchlauf `node scripts/test-usability-native.mjs` startet ausschließlich die gebaute Testversion mit einem temporären Projekt, prüft echte Tastatureingaben und beendet und startet das Programm erneut. Seine Ergebnisse und Bildschirmbilder liegen unter `artifacts/usability-native-*`.
