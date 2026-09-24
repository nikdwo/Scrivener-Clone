# Herkunft und Lizenzprüfung

Stand: 5. September 2026. Ziel dieser Umsetzung ist eine eigenständige private Anwendung mit nachvollziehbaren Abhängigkeiten. Diese technische Dokumentation ist keine anwaltliche Freigabe und keine Garantie, dass für jede spätere Veröffentlichung sämtliche Rechtsfragen geklärt sind.

## Referenz und Eigenentwicklung

Scrivener ist ein proprietäres Produkt. Seine Windows-EULA regelt insbesondere Änderungen, Reverse Engineering und Weitergabe; sie ist keine Open-Source-Lizenz. Es wurde deshalb kein Scrivener-Programmcode beschafft, zerlegt, übersetzt oder in dieses Projekt kopiert. Reverse Engineering von Binärdateien war für die hier implementierten, öffentlich beschriebenen Abläufe nicht erforderlich.

Die Referenzrecherche betraf öffentlich dokumentierte Arbeitsweisen: Hierarchie längerer Texte, Metadaten, Karten, Gliederung, Textstände, Recherche und Ausgabe. Die ursprüngliche Projektmappe war leer. Anwendungscode, Editoranbindung, Datenformat, UI-Gestaltung, Wortlaut, Vorlagentexte und Testbilder wurden in diesem Projekt erstellt. Kein Screenshot, Logo, Icon, mitgelieferter Romantext oder Handbuchauszug des Referenzprodukts wurde als Anwendungsasset übernommen. „Schreibatelier“ ist ein Arbeitsname; eine Markenverfügbarkeitsprüfung dieses Namens wurde nicht durchgeführt.

Das Programmsymbol verwendet das bereits in der Oberfläche eingesetzte „s.“-Monogramm und die Schreibatelier-Farben. Die Vektorfassung liegt unter `src/Schreibatelier.App/Assets/Schreibatelier.svg`; die Windows-ICO-Datei enthält Größen von 16 bis 256 Pixeln. Es wurde kein Symbol einer anderen Schreibanwendung übernommen.

Gelesene Referenzen:

- [Scrivener-Produktübersicht](https://www.literatureandlatte.com/scrivener/overview)
- [Scrivener Windows-Handbuch](https://www.literatureandlatte.com/docs/Scrivener_Manual-Win.pdf), Inhaltsübersicht und ausgewählte Funktionskapitel; die Datei wurde nicht ins Quellprojekt übernommen.
- [Scrivener Windows-EULA](https://www.literatureandlatte.com/wp-content/uploads/2023/09/Scrivener-EULA-Windows.pdf)
- [§ 69a UrhG](https://www.gesetze-im-internet.de/urhg/__69a.html), [§ 69d UrhG](https://www.gesetze-im-internet.de/urhg/__69d.html), [§ 69e UrhG](https://www.gesetze-im-internet.de/urhg/__69e.html). Sie unterscheiden unter anderem geschützte Ausdrucksformen und Ideen/Grundsätze sowie bestimmte eng begrenzte Nutzungshandlungen. Daraus wird hier keine pauschale Erlaubnis zur Übernahme fremden Codes abgeleitet.

## Eingesetzte Komponenten

| Komponente | Verwendung | Lizenz-/Herkunftsbehandlung |
|---|---|---|
| .NET, WPF, Microsoft.Data.Sqlite | Windows-App, Datenzugriff | MIT samt mitgelieferten weiteren Hinweisen der Runtime-Pakete |
| SQLitePCL.raw 2.1.12 | SQLite-Anbindung/native Bibliothek | Apache-2.0; originales LICENSE und NOTICE von ericsink/SQLitePCL.raw v2.1.12 ergänzt |
| WebView2 SDK 1.0.4191.47 | Einbettung des lokalen Editors | Der konkrete SDK-Pakettext erlaubt Weitergabe nach BSD-3-Clause-Bedingungen; LICENSE und NOTICE mitgeführt |
| WebView2 Runtime | Separat installierter Browserprozess | Eigene Microsoft-Runtime-Bedingungen; kein Bestandteil des ZIP-Pakets |
| Freie Tiptap-/ProseMirror-Pakete | Editor, Tabellen, Listen, Formatierung | MIT; keine kostenpflichtigen Tiptap-Erweiterungen eingesetzt |
| DOMPurify | HTML-Bereinigung beim Einfügen | Paket deklariert MPL-2.0 ODER Apache-2.0; Nutzung unter Apache-2.0, Originaltexte mitgeführt |
| diff | Haupttextvergleich | BSD-3-Clause, Originaltext mitgeführt |
| TypeScript, esbuild, Playwright | Entwicklung und Tests | Originaltexte und weitere Hinweise im Inventar; Entwicklungswerkzeuge werden nicht als Programme mit der App ausgeliefert |
| Pandoc 3.11 | Separater Dateikonverter | GPL; Download des unveränderten offiziellen Pakets durch Installationsskript, kein Pandoc-Binary im Anwendungs-ZIP |
| Typst 0.15.1 | Separater PDF-Satz | Apache-2.0, separat installiertes offizielles Paket, nicht im Anwendungs-ZIP |
| LanguageTool Snapshot 2026-09-05 | Lokale Sprachprüfung als eigener Prozess | Unverändertes offizielles Paket; COPYING.txt und sämtliche Paketressourcen samt Lizenzhinweisen bleiben unter Proofreading/languagetool erhalten. Herkunft und SHA-256 in scripts/install-proofreading.ps1 |
| Eclipse Temurin JRE 21.0.12.1+1 | Portable Java-Laufzeit für LanguageTool | Unverändertes offizielles Paket; NOTICE und legal-Verzeichnis bleiben unter Proofreading/java erhalten. Download samt Hersteller-Prüfsumme im Installationsskript fixiert |
| Codex CLI | Separat installierter Prozess für ChatGPT-Anmeldung und KI-Prüfung | Kein Bestandteil des Anwendungs-ZIP. Eigene Anmeldung der Schreibanwendung; Schnittstellen anhand CLI 0.147.0 geprüft |

Maßgeblich sind die vollständigen Pakettexte in `licenses`, nicht diese Kurzbezeichnungen. Das Inventar umfasst die lokal installierten Pakete einschließlich Entwicklung und heruntergeladener Runtime-Packs; es kann deshalb mehr Komponenten nennen, als im ZIP als Binärdatei vorhanden sind. Abhängige Bestandteile der .NET-Runtime sind in deren originalen Third-Party-Notices dokumentiert.

Weitere Primärquellen: [Tiptap-Quellprojekt](https://github.com/ueberdosis/tiptap), [ProseMirror](https://prosemirror.net/), [DOMPurify](https://github.com/cure53/DOMPurify), [WebView2-Sicherheit](https://learn.microsoft.com/microsoft-edge/webview2/concepts/security), [Pandoc-Handbuch](https://pandoc.org/MANUAL.html), [Pandoc-Lizenz](https://github.com/jgm/pandoc/blob/main/COPYING.md), [Typst-Lizenz](https://github.com/typst/typst/blob/main/LICENSE), [Fountain-Syntax](https://fountain.io/syntax/).

## Reproduzierbare Nachweise

`package-lock.json` und die NuGet-`packages.lock.json` fixieren Pakete. `scripts/licenses.mjs` kontrolliert die SPDX-Kurzbezeichnung jeder installierten Komponente und verlangt Original-Lizenztexte, übernimmt vorhandene NOTICE/Third-Party-Dateien und erzeugt:

- `THIRD_PARTY_NOTICES.txt` für Quelle und Anwendungsordner;
- `docs/licenses/` mit Originaltexten;
- `docs/components.json` mit Namen, Versionen, Quellen und npm-Integritätswerten;
- `docs/sbom.spdx.json` als SPDX-2.3-Inventar auf Paketebene.

Das plattformspezifische esbuild-Binärpaket verwendet den MIT-Text des versionsgleichen Hauptpakets. Fehlende SQLitePCL.raw-Lizenztexte wurden direkt aus dem versionierten Originalrepository beschafft; .NET-MIT aus runtime/v10.0.11. `scripts/fetch-license-sources.ps1` dokumentiert diese genauen URLs. Es wurden keine beliebigen Sammellizenztexte als Ersatz für unbekannte Abhängigkeiten angenommen.

`scripts/install-tools.ps1` enthält feste Download-URLs und SHA-256-Werte der offiziellen Pandoc-/Typst-Archive. Ihre Archive und entpackten Lizenzdateien bleiben lokal erhalten. Eigene Komponenten werden nicht als Open Source ausgegeben. Eine spätere Veröffentlichung ist eine neue Entscheidung, bei der die dann tatsächlich ausgelieferten Dateien, Lizenzen und Produktbezeichnung erneut zu prüfen sind.
