# Testversion Beziehungsnetz

Dieser auf `testing` entwickelte Ausbau basiert auf Alpha 5 und trägt die Kennung `0.1.0-alpha.5+testing.relationships`. Er ist kein neues GitHub-Release. Die Beziehungen werden ausschließlich lokal in der Projektdatei gespeichert; Konten, Internet und neue Abhängigkeiten sind dafür nicht nötig.

## Start und Beispielablauf

Im Projektordner **Testversion Beziehungsnetz.lnk** starten. Auch **Schreibatelier starten.lnk** verweist nach dem Testbuild auf dieselbe Anwendung. Die EXE liegt unter `artifacts/Schreibatelier-testing-relationships/app/Schreibatelier.exe`; der Fenstertitel enthält **Testversion Beziehungsnetz**. Zum eigenen Test ein temporäres Projekt oder eine Projektkopie verwenden.

1. Links zwei Figuren **Mara** und **Jonas**, den Ort **Hafenstadt** und den Gegenstand **Kompass** anlegen.
2. Den Ansichtsreiter **Beziehungsnetz** oder **Ansicht → Beziehungsnetz** öffnen. Alle verfügbaren Karten erscheinen mit ausgeschriebenem Kartentyp.
3. Mara anklicken. Rechts unter **Verknüpfte Karten → Beziehung anlegen** Jonas als Ziel wählen, **vertraut** eingeben und **Speichern** wählen.
4. Auf demselben Weg **Mara → wohnt in → Hafenstadt** und **Jonas → besitzt → Kompass** anlegen. Mit **Gegenseitig** erhält eine Verbindung Pfeile an beiden Enden.
5. Eine Verbindung über ihre Linie, Beschriftung oder die Beziehungsliste rechts öffnen. Bezeichnung und Notizen ändern und speichern. **Abbrechen** verwirft nur die offene Beziehungsbearbeitung. **Beziehung entfernen** verlangt eine Bestätigung und lässt beide Karten bestehen.
6. Eine Karte am kleinen Verschiebegriff ziehen und loslassen. Alternativ den Griff mit Tab fokussieren, mit Pfeiltasten in Zehnerschritten bewegen und mit Eingabe speichern. Escape bricht eine laufende Verschiebung ab; beim Verlassen des Griffs wird sie gespeichert.
7. Die Anwendung vollständig schließen, erneut starten und das Projekt öffnen. Im Beziehungsnetz sind Verbindungen und gespeicherte Positionen wieder vorhanden; die Ansicht beginnt mit **Gesamtansicht**.

Eine Beziehung braucht zwei unterschiedliche verfügbare Karten und eine Bezeichnung mit höchstens 200 Zeichen nach Entfernen äußerer Leerzeichen. Mehrere unterschiedlich benannte Beziehungen zwischen denselben Karten sind möglich. Gleiche Verbindungen werden abgewiesen; bei gegenseitigen Beziehungen gilt das auch mit vertauschten Endpunkten. Bezeichnungen unterscheiden Groß- und Kleinschreibung.

## Orientierung und Bearbeitung

- **Karte suchen** durchsucht Namen und alternative Namen. Ein Treffer öffnet die Karte rechts, fokussiert sie im Netz und scrollt sie in den sichtbaren Bereich.
- **Nur direkte Verbindungen** zeigt die ausgewählte Karte und ihre unmittelbaren Nachbarn. Ausschalten zeigt wieder alle verfügbaren Karten.
- **Gesamtansicht**, **Vergrößern** und **Verkleinern** ändern den Ausschnitt. Der Netzbereich ist mit Maus und Tastatur scrollbar. Auswahl, Suche, Filter, Zoom und Ausschnitt bleiben bei einem Ansichtswechsel im selben Projekt erhalten; ein anderes Projekt setzt sie zurück.
- Die automatische Anordnung gruppiert zusammenhängende Karten in Rastern. Unverbundene Karten erhalten einen getrennten Rasterbereich. Neue Karten bekommen freie Plätze, vorhandene behalten ihre Position. **Neu anordnen** berechnet und speichert das gesamte Raster neu.
- Ein Kartenklick öffnet die vorhandene Kartenbearbeitung im Notizbuch. Kartenfelder verwenden weiterhin Autosave. Das bisherige Figurenfeld **Beziehungen** heißt jetzt **Beziehungsnotizen**; sein Freitext wird erhalten und erzeugt keine Verbindungen. Besitzerangaben und sonstige Kartenfelder bleiben erhalten.

## Speicherung und Fehlerfälle

Beziehungen und Positionen liegen zentral in `settings.relationshipNetwork`, unabhängig von Pinnwandpositionen und Karten-Textständen. Eine gespeicherte Beziehung enthält ID, Ausgangs- und Zielkarten-ID, Bezeichnung, Richtung und Notizen. Kartenpositionen verwenden die Dokument-ID und endliche Koordinaten von 0 bis 1.000.000. Die bestehende Gesamtgrenze von 2 MB für Projekteinstellungen gilt weiterhin.

Bei einem Speicherfehler bleibt das Beziehungsformular mit den Eingaben geöffnet. Erneut **Speichern** versuchen oder ausdrücklich **Abbrechen** wählen. Ein Ansichts-, Karten- oder Projektwechsel wird bei offenen Änderungen blockiert. Fehlgeschlagene Positionen bieten **Erneut speichern** und **Verschiebung verwerfen**. Änderungen an anderen Einstellungsblöcken werden beim Speichern zusammengeführt; konkurrierende Änderungen am selben Block melden einen Konflikt.

Im Papierkorb bleiben Verweise gespeichert. Verbindungen zu gelöschten Karten verschwinden aus dem Netz, stehen an noch verfügbaren Karten aber als **nicht verfügbar** in der Liste. Wiederherstellen aktiviert sie erneut. Ein Kartenduplikat hat eine neue ID und beginnt ohne Verbindungen und ohne eigene gespeicherte Netzposition. Das Wiederherstellen eines Karten-Textstands verändert das zentrale Netz nicht; vollständige Projektsicherungen und Projektkopien enthalten es.

Schreibgeschützte Projekte erlauben Ansicht, Suche und Navigation. Beziehungsänderungen und dauerhafte Positionsänderungen sind gesperrt. Manuskripttext, Reihenfolge, Text-Rückgängigverlauf und Manuskriptexport enthalten keine Netzbestandteile. Diese Version zeigt einen Beziehungsstand ohne zeitlichen Verlauf.
