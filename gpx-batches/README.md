# GPX-Abgleich – Trail Event Planer

Stand: 20.11.2026

## Umfang
- 128 Hauptevents in der Reihenfolge der App-Datenbank geprüft.
- 454 Streckenvarianten erfasst.
- Alle 26 Arbeitspaket-Checkpoints für 128 Hauptevents am 20.11.2026 erneut nachbearbeitet; je Paket sind Quellen, offene GPX-Schritte und Editionsstände dokumentiert.
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
Die GPX-URLs und Importfunktion sind in der App hinterlegt. Die GPX-Dateien selbst wurden in diesem Arbeitsschritt **nicht als Dateien in das GitHub-Repository kopiert**. Die gespeicherten Links und Veranstalterseiten wurden geprüft; ein erfolgreicher Download und XML-Import der externen Binärdateien ist jedoch nicht für alle Strecken nachgewiesen. Deshalb werden Links, offizielle Verfügbarkeit und technisch geparste Dateien strikt unterschieden. Unversionierte Kandidaten sind als solche gekennzeichnet.

## Versions- und Aufbewahrungsregel
- Eine vorhandene ältere GPX-Datei bleibt als **letzte verfügbare Streckenversion** erhalten, bis eine neue offizielle GPX-Datei veröffentlicht und geprüft wurde.
- Neue offizielle Dateien werden als neue Version ergänzt; ältere Dateien werden weder überschrieben noch gelöscht.
- Jahrgang, Quelle und Prüfstatus müssen an jeder Version erkennbar bleiben.
- Solange keine neue offizielle Datei vorliegt, bleibt die ältere Datei verfügbar. Falls eine Streckenänderung bekannt ist oder vermutet wird, erhält sie zusätzlich den Hinweis **historische Strecke – Übereinstimmung mit aktueller Route nicht bestätigt**.
- Eine Einschränkung des Veranstalters zur Nutzung oder Weitergabe bleibt verbindlich; sie wird nicht durch diese Aufbewahrungsregel aufgehoben.

## Prüfstatus (20.11.2026)\n- Alle 128 Hauptevents und 454 Streckenvarianten sind in 26 Prüfpaketen dokumentiert.\n- 53 direkte GPX-URLs waren im ursprünglichen Datenabgleich erfasst; weitere Map-/Outdooractive-/Drive-Quellen sind separat dokumentiert.\n- Ein Link gilt nicht als technisch geprüfte GPX-Datei. Als technisch geprüft darf eine Strecke erst gelten, wenn die tatsächliche Datei abgerufen, das XML geparst und Trackpunkte sowie Distanz/Höhenmeter kontrolliert wurden.\n- 2027-Dateien werden als eigene Versionen ergänzt. Ältere offizielle Dateien bleiben bis zum geprüften Ersatz erhalten.\n\n## Sicherheitsregel
Nur Dateien mit passendem Veranstalter-/Jahresstand als aktuelle Strecke übernehmen. Bei GPX-Links mit altem Jahr, unklarer Distanz oder noch nicht finaler Strecke zuerst Veranstalterseite prüfen.