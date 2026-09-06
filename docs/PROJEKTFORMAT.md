# Projektformat 1

`.schreibprojekt` ist eine SQLite-Datenbank mit `PRAGMA user_version=1`. Alle Projektinhalte sind in dieser Datei enthalten. Die benachbarte Sperrdatei enthält keine Manuskriptdaten. SQLite kann während einer Transaktion vorübergehend eine Journaldatei verwenden; ein geöffnetes Projekt sollte deshalb mit der integrierten Kopie-/Sicherungsfunktion kopiert werden.

| Tabelle | Inhalt |
|---|---|
| `project` | Eine Projektkennung (32 Hexzeichen), Titel, Einstellungen als JSON |
| `documents` | Kennung, Elternkennung, Position, Titel, Art, Editor-JSON, Metadaten, Revision, Papierkorbstatus, Wortzahl, Klartextindex, Änderungszeit |
| `assets` | Kennung, Originalname, MIME-Angabe, vollständiger Dateiinhalt als BLOB |
| `snapshots` | Kennung, Abschnitt, Bezeichnung, Zeit, vollständiger Editorbaum und Metadaten |
| `history` | Lokales Kalenderdatum und Nettowortänderungen bei Textspeicherungen |

Die beiden unverrückbaren Wurzeln heißen `manuscript` und `research`. Abschnittsarten sind `folder`, `text`, `script` und `asset`. Ein Anhangsabschnitt verweist in `meta.assetId` auf eine Assetkennung. Editorbilder verwenden ausschließlich `https://assets.schreibatelier.local/<Kennung>`; das ist eine interne Adresse, kein Internet-Host.

Das Editorformat ist ein validierter Tiptap-/ProseMirror-JSON-Baum. `footnote` ist ein Inline-Element mit `id` und Klartext `text`; `comment` ist eine Textmarkierung mit denselben Feldern. `script` ist ein Block mit `element` zur Kennzeichnung des Drehbuchelements. Format- und Inhaltsknoten werden beim Speichern und beim Laden eines Abschnitts geprüft.

Speicherungen vergleichen die geladene Revision mit der Datenbankrevision. Eine veraltete Änderung wird abgelehnt; mehrere Abschnittsänderungen sind eine SQLite-Transaktion. Auch Teilen und Zusammenführen erfolgen atomisch. Die Anwendung verwendet `synchronous=FULL`, Foreign Keys und eine exklusiv geöffnete Dateisperre für den schreibenden Prozess. Eine zweite Anwendung öffnet die Datenbank schreibgeschützt.

Sicherungen werden mit der SQLite-Backup-API erstellt und mit `quick_check` geprüft. Wiederherstellung überschreibt die Originaldatei nicht. Unbekannte Formatversionen werden ohne automatische Migration abgewiesen. Diese Version besitzt noch keine produktive Vorgängerversion.
