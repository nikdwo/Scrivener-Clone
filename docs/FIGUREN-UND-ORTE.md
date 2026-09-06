# Figuren, Orte und Gegenstände – Alpha 5

Figuren, Orte und Gegenstände gehören seit Alpha 4 zur Anwendung.

## Starten und ausprobieren

Alpha 5 installieren oder das portable ZIP entpacken und `Schreibatelier.exe` starten. Der lokale Release-Build liegt unter `artifacts/Schreibatelier-0.1.0-alpha.5/app/Schreibatelier.exe`. Eine bereits laufende ältere Version vorher schließen.

1. Ein Projekt und darin einen Textabschnitt im Manuskript öffnen.
2. Links im eigenen Bereich **Figuren, Orte & Gegenstände → Figuren → Figur anlegen** wählen und beispielsweise **Mara Berg** eingeben. Alternativ rechts im Notizbuch **Figuren, Orte & Gegenstände → Figur anlegen** wählen. Im schmalen Fenster lässt sich das Notizbuch oben öffnen.
3. Unter **Alternative Namen** beispielsweise **Heimkehrerin** eintragen. Rolle, Motivation, Konflikt, Beziehungen, Entwicklung und Notizen ergänzen. Mit **Eigenes Feld hinzufügen** lassen sich zusätzliche Textfelder anlegen, umbenennen und entfernen.
4. **Dieser Szene zuordnen** verbindet die Karte dauerhaft mit dem geöffneten Abschnitt. Dieselbe Karte lässt sich mehreren Abschnitten zuordnen; ihre zugeordneten Szenen sind direkt anklickbar.
5. Im Manuskript beispielsweise `Mara Berg ist die Heimkehrerin.` schreiben. Die Namen erhalten nach einer kurzen Pause eine dezente Unterstreichung. Ein Klick öffnet die Karte rechts und lässt den Manuskripttext an seiner Position.
6. Für einen ausdrücklichen Verweis einen Namen im Manuskript markieren, die gewünschte Karte öffnen und **Markierten Text verknüpfen** wählen. **Strg+Z** macht diesen Link rückgängig.

**Ort anlegen** funktioniert ebenso, mit Feldern für Atmosphäre, besondere Merkmale, Bedeutung und Notizen. Links stehen Figuren, Orte und Gegenstände in getrennten, einklappbaren Listen außerhalb von **Recherche**. Auch schon vorhandene Karten erscheinen automatisch dort. Ein Klick oder die Eingabetaste öffnet eine Karte rechts; der Manuskriptabschnitt bleibt geöffnet. Die Kartenliste im Notizbuch lässt sich nach Namen und alternativen Namen durchsuchen sowie nach Typ filtern. Die Vorlagen **Figur**, **Ort** und **Gegenstand** öffnen ebenfalls die Kartenerstellung. Vorhandene Vorlagentexte werden nicht verändert.

**Gegenstand anlegen** erstellt beispielsweise eine Karte für einen Silberschlüssel. Dafür gibt es Beschreibung, besondere Merkmale, Besitzer/Zugehörigkeit, Herkunft, Bedeutung für die Handlung und Notizen. Links steht dafür die eigene Liste **Gegenstände**; im Notizbuch gibt es denselben Kartentyp im Filter. Alternative Namen, eigene Felder, Szenenzuordnungen, Textverweise und Papierkorb funktionieren wie bei Figuren und Orten.

## Erkennung und Speicherung

- **Dieser Szene zugeordnet** enthält bewusste Zuordnungen. **Im Text erkannt** enthält automatische Treffer im aktiven Editor. Automatische Treffer verändern die Zuordnungen nicht.
- Die Erkennung bleibt lokal und benötigt kein Konto. Sie berücksichtigt Groß-/Kleinschreibung und Wortgrenzen; „Anna“ trifft nicht „Annabelle“. Alternative Schreibweisen explizit als alternative Namen ergänzen.
- Bei überlappenden Namen gewinnt der längere Treffer. Gehört derselbe Name zu mehreren Karten, erscheint eine Auswahl. Fußnoten, Codeblöcke und bereits verlinkte Stellen werden nicht automatisch markiert.
- **Namen automatisch erkennen** schaltet die Erkennung für das Projekt um. Bewusste Textverweise und Szenenzuordnungen bleiben bestehen.
- Karten bleiben in derselben Projektdatei gespeichert. Sie verwenden die vorhandenen Sicherungen, den Schreibschutz und das automatische Speichern. Erst **Alle Änderungen gespeichert** bestätigt die Speicherung.
- Karten links per **Rechtsklick → In den Papierkorb verschieben** entfernen; dasselbe Menü öffnet **Umschalt+F10** auf einem fokussierten Eintrag. Karten im Papierkorb bleiben wiederherstellbar. Ihre Szenenzuordnungen werden als nicht verfügbar angezeigt und funktionieren nach dem Wiederherstellen wieder.
- Teilen und Duplizieren übernehmen Szenenzuordnungen; Zusammenführen vereinigt sie ohne Duplikate. Exporte enthalten keine automatischen Markierungen; ausdrückliche Kartenlinks werden als normaler, weiterhin formatierter Text ausgegeben.

Der erste Umfang umfasst Figuren, Orte und Gegenstände mit Textfeldern. Bildsteckbriefe, automatische Pronomenzuordnung, Zeitstrahl, Beziehungsdiagramme und eine KI-Auswertung sind nicht Bestandteil dieser Erweiterung.
