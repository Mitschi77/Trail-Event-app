# NORTHBOUND – verbindlicher Design- und Bedienstandard

Stand: 24. November 2026

Dieser Standard gilt für die gesamte Trailrunning-App und alle künftigen Oberflächen, Komponenten und Erweiterungen.

## Unveränderliche Markenfarben

| Farbe | Wert | Verwendung |
|---|---|---|
| Anthrazit | `#0B1117` | App-Grundfläche |
| Signalorange | `#FF6A00` | Aktionen, wichtige Hervorhebungen und abgeschlossene Zielanteile |
| Eisblau | `#7FD8FF` | Messwerte, Informationsgrafiken und Fokuszustände |
| Gletscherweiß | `#F5F7FA` | Primäre Schrift und klare Kontraste |

Dunkle Schiefer- und Graphit-Abstufungen dürfen als neutrale Flächen und Trennlinien eingesetzt werden. Es werden keine zusätzlichen Marken- oder Statusfarben eingeführt. Insbesondere kein Grün und keine lime-/olivfarbenen Flächen.

## Verbindliche Bedienprinzipien

1. **Grafik vor Liste:** Kennzahlen, Zeitverläufe, Höhenprofile, Fortschritt und Vergleiche werden vorrangig grafisch dargestellt. Listen bleiben Detail- und Suchansichten.
2. **Aussage vor Dekoration:** Jede Grafik muss eine konkrete Frage beantworten. Keine dekorativen Diagramme ohne Datenbezug.
3. **Drei-Sekunden-Prinzip:** Auf jeder Hauptseite muss sofort erkennbar sein, was wichtig ist und welche nächste Handlung sinnvoll ist.
4. **Progressive Details:** Erst die wesentliche Aussage zeigen. Ausführliche Quellen, Statusdetails und Bearbeitungsfelder werden bei Bedarf aufgeklappt.
5. **Wenige Ebenen:** Ein konsistentes Hauptmenü mit klaren Unterbereichen; keine konkurrierenden Navigationssysteme.
6. **Einheitliche Kennzahlen:** Große Zahlen, kurze Beschriftungen, konsistente Einheiten und nachvollziehbare Diagrammskalen.
7. **Gerätegerecht:** iPhone, iPad und Desktop erhalten passende Dichten und Anordnungen; Touch-Ziele bleiben gut bedienbar.
8. **Barrierearme Information:** Farbe ist nie der einzige Statushinweis. Beschriftungen, Kontrast, Tastaturfokus und reduzierte Bewegung bleiben erhalten.

## Gestaltungsregeln nach Bereich

- **Cockpit:** Saisonfortschritt, UTMB Index, nächster Wettkampf und Regeneration als visuelle Prioritäten.
- **Events:** kompakte Eventkarten mit Distanz, Höhenmetern, Datum und kleinem Strecken-/Höhenprofil; Filter schnell erreichbar.
- **Eventdetails:** Kennzahlen und Höhenprofil zuerst, Quellen und lange Angaben nachgeordnet.
- **Jahresübersicht:** Kalender und Belastungsverlauf zuerst; Rennkarten als ergänzende Details.
- **Planung:** visuelle Saison- und Regenerationszeitachse; Planungsentscheidungen bleiben nachvollziehbar.
- **Laufhistorie:** Leistungsentwicklung und Jahreswerte grafisch; einzelne Läufe als Detailkarten.
- **Daten & Verwaltung:** Datenqualität, offene Angaben und Konflikte als kompakte Statusübersicht mit klaren nächsten Aktionen.

## Technische Leitplanken

- Bestehende Event-, Strecken-, Lauf- und Nutzerdaten bleiben erhalten.
- Keine Änderung an Berechnungs- oder Synchronisierungslogik ohne gesonderte fachliche Notwendigkeit.
- Bestehende IDs, Aktionen und Navigationseinstiege bleiben kompatibel.
- Jede neue Darstellung muss auf realen App-Daten beruhen; keine erfundenen Beispielwerte in der Produktivoberfläche.
- Service-Worker-Cache nach UI-Änderungen versionieren.
- Vor Veröffentlichung Syntax-/Regressionstests sowie echte iPhone- und iPad-Prüfung durchführen.
