# Sprachprüfung

Auf `testing` steht zusätzlich **Stilanalyse · lokal** zur Verfügung: eigenständige lokale Hinweise zu Wiederholungen, Satzlängen und Formulierungen ohne Konto oder gestartete LanguageTool-Engine. Anleitung und Grenzen: [Stilanalyse](STILANALYSE.md). Die folgenden Anbieterhinweise gelten weiterhin für die bisherigen drei Sprachprüfverfahren.

Stand: 6. September 2026. Die drei Prüfverfahren sind implementiert. Die lokale Prüfung ist mit der echten Engine und Windows-Anwendung getestet. ChatGPT wurde mit einem verbundenen Benutzerkonto und GPT-5.6-Sol an einem kurzen deutschen Prüfsatz erfolgreich getestet. Für LanguageTool Premium ist die Textprüfung mit einem Benutzerkonto noch offen.

## Bedienung

**Alpha 5 starten:** Nach der Installation **Schreibatelier Alpha 5** im Startmenü öffnen oder das portable ZIP vollständig entpacken und **Schreibatelier.exe** starten. Im Quellprojekt öffnet die Verknüpfung **Schreibatelier starten** den Build unter `artifacts\Schreibatelier-0.1.0-alpha.5\app\Schreibatelier.exe`. Alpha 1 enthält diese Sprachprüfungsansicht noch nicht.

1. Einen Textabschnitt öffnen und **Prüfen** in der Werkzeugleiste oder im rechten Notizbuch wählen.
2. Sprache auswählen: Deutsch (Deutschland), Deutsch (Österreich) oder Deutsch (Schweiz). Die Sprache wird im Projekt gespeichert.
3. **Abschnitt prüfen** starten oder zuvor Text markieren und **Markierung prüfen** wählen. Online zeigt die Ansicht vor dem Start Empfänger und Zeichenanzahl.
4. Ein Hinweis zeigt Fundstelle, Erklärung, Kategorie und Ersatzvorschläge. Eine Korrektur lässt sich einzeln übernehmen und mit **Strg+Z** rückgängig machen. Nach einer Änderung wird neu geprüft; alte Ergebnisse werden verworfen.

Stilhinweise sind optional. Die lokale Prüfung lässt sich nach einer Eingabepause automatisch starten, solange die Prüfungsansicht geöffnet ist. Online-Prüfungen werden ausdrücklich gestartet. Namen und erfundene Begriffe können über **Wort erlauben** oder das Projektwörterbuch von Rechtschreibhinweisen ausgenommen werden; Grammatikhinweise bleiben erhalten.

## Lokal prüfen und Konten anmelden

Die Anmeldung befindet sich im rechten Notizbuch unter **Prüfen → Prüfverfahren**. Erst nach Auswahl eines Online-Anbieters erscheint sein Anmeldeknopf. Die lokale Prüfung benötigt kein Konto.

- **Lokal:** `Lokal · LanguageTool` wählen. Unter dem Auswahlfeld muss **Lokale Prüfung verfügbar.** stehen. **Abschnitt prüfen** anklicken. Für einen kurzen Versuch eignet sich `Das ist ein Feler. Ich habe ein Apfel gegessen.`. Der erste Start lädt die lokale Engine und kann einige Sekunden dauern.
- **LanguageTool:** `LanguageTool Premium · online` wählen → **Konto verbinden**. E-Mail des LanguageTool-Kontos und dessen **Zugriffsschlüssel** eingeben → **Verbinden**. Das Feld erwartet den Zugriffsschlüssel, nicht das Kontopasswort. Anschließend **Abschnitt prüfen** anklicken.
- **ChatGPT:** `ChatGPT-Abo · Codex` wählen → **Mit ChatGPT anmelden**. Im Browser mit dem vorhandenen ChatGPT-Konto anmelden. Zur Anwendung zurückkehren → **Status aktualisieren** → unter **KI-Modell** ein angebotenes Modell auswählen → **Abschnitt prüfen**.

Falls **Prüfen** nicht zu sehen ist: zuerst ein Projekt und einen Textabschnitt öffnen; einen aktiven Fokusmodus mit **F11** beenden. Bei schmalem Fenster oben **Notizbuch** öffnen. Fehlt der Reiter weiterhin, die oben genannte Startverknüpfung verwenden. Eine Meldung im Bereich unter **Prüfverfahren** beschreibt einen fehlenden lokalen Bestandteil oder einen Verbindungsfehler.

## Prüfverfahren

| Verfahren | Einrichtung | Verhalten |
|---|---|---|
| Lokal · LanguageTool | Im Windows-Paket enthalten: LanguageTool und eine portable Java-Laufzeit. Im Quellprojekt einmal `scripts/install-proofreading.ps1` ausführen. | Startet bei Bedarf einen eigenen Server auf diesem Rechner. Es werden keine Manuskripttexte an einen Online-Prüfdienst gesendet. Die lokale Basis enthält keine KI-basierten Cloud-Regeln. |
| LanguageTool Premium · online | **Konto verbinden**: E-Mail und Zugriffsschlüssel aus den LanguageTool-Kontoeinstellungen eingeben. | Der Zugang wird mit einem kurzen Beispielsatz geprüft und nur bei bestätigter Premium-Berechtigung gespeichert. Kontingent- und Verbindungsfehler werden angezeigt. |
| ChatGPT-Abo · Codex | Installierte offizielle Codex CLI erforderlich. **Mit ChatGPT anmelden**, Browseranmeldung abschließen, dann **Status aktualisieren**. | Die Modellauswahl kommt aus der tatsächlichen Modellliste des Anschlusses. Es gelten die Kontingente des Abos; es gibt keinen automatischen Wechsel auf separat abgerechnete API-Nutzung. |

LanguageTool-Zugriffsschlüssel: [Kontoeinstellungen](https://languagetool.org/editor/settings/access-tokens). Die Windows-Benutzerverschlüsselung schützt den gespeicherten Schlüssel; er steht weder im Manuskript noch in den gewöhnlichen Projekteinstellungen. **Trennen** entfernt den gespeicherten Zugang.

Für ChatGPT verwendet Schreibatelier eine eigene Codex-Anmeldung im Benutzerprofil. Bestehende Anmeldungen anderer Codex-Programme werden dadurch nicht ersetzt. **Trennen** meldet dieses Profil ab. Die Textprüfung verwendet kurzlebige Sitzungen; Datei-, Shell- und Webwerkzeuge werden für diesen Zweck deaktiviert. Modellantworten werden nur als Korrekturvorschläge verarbeitet: Die Originalstelle muss im eingereichten Text exakt und eindeutig vorkommen.

In der portablen Variante liegen auch die Anbieterzugänge unter `Data`. Sie werden nicht aus einer installierten Variante übernommen. Der LanguageTool-Zugriffsschlüssel ist an den Windows-Benutzer gebunden; bei einem Rechner- oder Benutzerwechsel erneut verbinden.

Die Anbindung verwendet ein benanntes Berechtigungsprofil ohne Dateizugriff und Werkzeug-Netzwerkzugriff. Dieses wird beim Sitzungsstart über `permissions` ausgewählt und vom App Server bestätigt. Das von Codex CLI 0.147.0 abgewiesene alte Feld `readOnly.access` wird nicht mehr gesendet.

## Bestätigte Prüfungen und Grenzen

- Die echte lokale Engine findet im Prüfsatz sowohl `Feler` als auch den Grammatikfehler in `Ich habe ein Apfel gegessen.`. Alle drei deutschen Sprachvarianten akzeptieren Prüfaufträge. Das belegt diese Beispiele, keine vollständige sprachliche Qualität.
- UTF-16-Positionen, Emoji, Absatzgrenzen, Teilmarkierungen, lange Absätze und Fußnoten-Barrieren sind durch ausführbare Prüfungen abgedeckt. Browserprüfungen kontrollieren außerdem Formatierung, Rückgängig, veraltete Ergebnisse, Projektwörterbuch und Schreibschutz.
- Die native Windows-Integration prüft LanguageTool → Editor-Markierung → Korrektur → SQLite-Speicherung → Rückgängig.
- Mit Codex CLI 0.147.0 wurden das verbundene ChatGPT-Konto, die angebotene Modellliste und eine echte Textprüfung mit GPT-5.6-Sol bestätigt. Der Prüfsatz lieferte `Feler` → `Fehler` und `ein Apfel` → `einen Apfel`. Das bestätigt diesen Ablauf und diese Beispiele, keine umfassende KI-Prüfqualität. Eine echte LanguageTool-Premium-Prüfung mit Benutzerzugang steht noch aus.
- Geprüft wird der ausgewählte Text oder der aktive Abschnitt. Fußnoteninhalt und eingebettete Medien werden ausgelassen. Korrekturen überschreiten keine Absatz- oder Mediengrenzen. Absätze über 8.000 Zeichen werden geteilt; dadurch ist der Kontext an einer Teilgrenze begrenzt. Aufträge sind auf eine Million Zeichen begrenzt und werden in kleinere Anbieteranfragen aufgeteilt.
- KI-Hinweise benötigen die Entscheidung des Autors. Uneindeutige oder nicht mehr passende Textstellen werden nicht übernommen.

Eine Claude-Abo-Verbindung ist nicht enthalten: Anthropic dokumentiert für Drittanbieter eine vorherige Genehmigung zur Verwendung von claude.ai-Anmeldung und Abo-Kontingenten. Es wurde keine solche Genehmigung behauptet oder ein Ersatz über separat abgerechnete APIs eingebaut.

## Technische Quellen

[Lokaler LanguageTool-Server](https://dev.languagetool.org/http-server), [LanguageTool-API-Spezifikation](https://languagetool.org/http-api/languagetool-swagger.json), [Codex App Server](https://learn.chatgpt.com/docs/app-server), [Codex-Berechtigungsprofile](https://learn.chatgpt.com/docs/permissions), [Codex-Anmeldung](https://learn.chatgpt.com/docs/auth), [Anthropic Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview).

Die installierten Downloads und SHA-256-Prüfsummen stehen in `.tools/proofreading-sources.json`, im Release unter `Proofreading/sources.json`. Original-Lizenztexte der Sprachprüfung und Java-Laufzeit bleiben in ihren mitgelieferten Verzeichnissen erhalten.
