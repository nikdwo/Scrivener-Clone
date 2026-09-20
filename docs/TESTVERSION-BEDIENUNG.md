# Testversion Schreibansicht & Zeitstrahl

Version: `0.1.0-alpha.6+testing.usability`, auf `testing`. Diese Testversion veröffentlicht keine neue Alpha-Version und erstellt keinen Installer.

## Starten

Im Projektordner **Testversion Schreibansicht & Zeitstrahl.lnk** oder **Schreibatelier starten.lnk** öffnen. Nach `scripts/build.ps1 -Testing` zeigen beide auf `artifacts/Schreibatelier-testing-usability/app/Schreibatelier.exe`. Der gesamte Anwendungsordner wird benötigt.

## Die fünf Änderungen ausprobieren

1. **Ordner und Eingabefenster:** Links **＋ Ordner** wählen, „Erstes Kapitel“ eingeben und **Enter** drücken. Im Ordner zwei Texte anlegen. Die Ordnerübersicht zeigt Namen und Einrückungen automatisch. Beim Umbenennen eines Textes aktualisiert sich auch die Übersicht. **Ordnertext** öffnet den eigenen Text des Ordners, **Zur Übersicht** führt zurück. Enter bestätigt einzeilige Eingaben; in mehrzeiligen Notizen erzeugt es weiterhin einen Zeilenumbruch. Escape, Abbrechen und × verwerfen die Eingabe.
2. **A4:** Einen längeren Text schreiben oder einfügen. Die Seiten sind A4 im Hochformat mit 25 mm Rand; der Text fließt auf weitere Seiten und beim Löschen zurück. Mit **Mit Unterabschnitten** laufen die Abschnittstexte fortlaufend über dieselben Seiten. Das Notizbuch breiter oder schmaler ziehen: Die Papieransicht skaliert, die Zeilenumbrüche bleiben erhalten. PDF und Druckvorschau verwenden weiterhin ihr eigenes Ausgabeprofil.
3. **Auswahllisten:** Dunkelmodus einschalten und eine Auswahlliste öffnen, etwa das Absatzformat oder Prüfverfahren. Die aufgeklappten Einträge haben schwarze Schrift auf hellem Hintergrund.
4. **Zeitstrahl:** Relative Tage einrichten und zwei Handlungsstränge anlegen. Eine Szene auf Tag 1, 09:00–12:00 setzen. Den Balken oder Szenenknopf mit der linken Maustaste halten und ziehen. Links/rechts verschiebt die Zeit, eine andere Bahn ändert den Handlungsstrang. Die Randgriffe ändern Beginn und Ende. Die Anzeige neben dem Mauszeiger zeigt die Position und die vorgeschlagenen Zeiten. Erst Loslassen übernimmt die Änderung; Escape bricht ab. Am sichtbaren Rand scrollt die Zeitachse weiter.
5. **Neustart:** Speichern, das Programm vollständig schließen und erneut öffnen. Ordnertexte, Namen, Szenenzeiten und Handlungsstränge müssen erhalten bleiben.

## Genauigkeit und Tastatur im Zeitstrahl

Uhrzeiten werden minutengenau verändert. Ohne Uhrzeit bleiben Grenzen tagesgenau. Hat eine Szene mindestens eine tagesgenaue Grenze, verschiebt sich die ganze Szene in ganzen Tagen. Die Uhrzeit an der Mausposition dient dann nur der Orientierung.

Ein Ereignis ohne Ende kann mit einem Randgriff zu einem Zeitraum aufgezogen werden. Eine ungeplante Szene bekommt beim Ablegen auf einer Bahn einen tagesgenauen Beginn ohne Ende. Für die Zuordnung zu einer anderen Bahn muss diese sichtbar sein; bei Bedarf den Handlungsstrangfilter auf **Alle** setzen.

Mit Tab einen Szenenknopf oder Randgriff erreichen. **Leertaste** startet die Verschiebung, **Links/Rechts** ändern die Zeit und beim Verschieben wechseln **Oben/Unten** die Bahn. **Enter** übernimmt, **Escape** bricht ab. Im Schreibschutz sind diese Änderungen gesperrt; die Ansicht und die Details bleiben zugänglich.

## Datenerhalt

Papierseiten und Ordnerübersichten werden nicht in den Manuskripttext geschrieben. Die bestehende Projektdatei und automatische Speicherung werden weiterverwendet. Bei einem Speicherfehler bleiben Änderungen im Puffer; die Fehlermeldung beachten und nach Beheben der Ursache erneut speichern. Für erste Versuche empfiehlt sich ein eigenes Testprojekt.

Automatische Prüfungen: `scripts/test.ps1`, `npm run test:ui`. Der zusätzliche native Durchlauf `node scripts/test-usability-native.mjs` startet ausschließlich die gebaute Testversion mit einem temporären Projekt, prüft echte Tastatureingaben und beendet und startet das Programm erneut. Seine Ergebnisse und Bildschirmbilder liegen unter `artifacts/usability-native-*`.
