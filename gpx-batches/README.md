# GPX-Abgleich – Trail Event Planer

Stand: 17.11.2026

## Umfang
- 128 Hauptevents in der Reihenfolge der App-Datenbank geprüft.
- 454 Streckenvarianten erfasst.
- 26 Arbeitspaket-Checkpoints gespeichert (jeweils fünf Events; letztes Paket umfasst die restlichen drei).
- 53 direkte GPX-Datei-Links sind aktuell in den Streckendaten hinterlegt.
- Zusätzlich sind offizielle Veranstalterseiten mit Map + GPX, Komoot-/Garmin-Downloads und angekündigte spätere Freigaben vermerkt.

## Arbeitspakete
Die Detailergebnisse liegen in `batch-01-2026-11-17.json` bis `batch-26-2026-11-17.json`. Jeder Checkpoint enthält den Status je Event, Quellen und den nächsten Prüfschritt.

## Import in der App
In der Streckendetailansicht:
1. Bei einer Strecke mit direktem GPX-Link **GPX in Streckenkarte übernehmen** wählen.
2. Die App lädt und parst den Track und speichert ihn in den lokalen Streckendaten des verwendeten Browsers.
3. Falls der Veranstalter-Server den Browser-Download wegen CORS blockiert, GPX über den Download-Link speichern und anschließend über **Daten ergänzen / bearbeiten → GPX-Datei für Höhenprofil** importieren.

## Wichtige Abgrenzung
Die GPX-URLs und Importfunktion sind in der App hinterlegt. Die GPX-Dateien selbst wurden in diesem Arbeitsschritt **nicht als Dateien in das GitHub-Repository kopiert**. Die verfügbaren GitHub- und Laufzeitwerkzeuge konnten die externen GPX-Dateien nicht direkt herunterladen; deshalb wird kein Download oder Import als bereits abgeschlossen ausgegeben. Unversionierte Kandidaten sind als solche gekennzeichnet.

## Versions- und Aufbewahrungsregel
- Eine vorhandene ältere GPX-Datei bleibt als **letzte verfügbare Streckenversion** erhalten, bis eine neue offizielle GPX-Datei veröffentlicht und geprüft wurde.
- Neue offizielle Dateien werden als neue Version ergänzt; ältere Dateien werden weder überschrieben noch gelöscht.
- Jahrgang, Quelle und Prüfstatus müssen an jeder Version erkennbar bleiben.
- Solange keine neue offizielle Datei vorliegt, bleibt die ältere Datei verfügbar. Falls eine Streckenänderung bekannt ist oder vermutet wird, erhält sie zusätzlich den Hinweis **historische Strecke – Übereinstimmung mit aktueller Route nicht bestätigt**.
- Eine Einschränkung des Veranstalters zur Nutzung oder Weitergabe bleibt verbindlich; sie wird nicht durch diese Aufbewahrungsregel aufgehoben.

## Sicherheitsregel
Nur Dateien mit passendem Veranstalter-/Jahresstand als aktuelle Strecke übernehmen. Bei GPX-Links mit altem Jahr, unklarer Distanz oder noch nicht finaler Strecke zuerst Veranstalterseite prüfen.