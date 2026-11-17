# GPX-Abgleich – Trail Event Planer

Stand: 17.11.2026

## Umfang

- 128 unterschiedliche Veranstaltungen in der aktuellen Event-Datenbank geprüft.
- 451 Strecken-Einträge mit einem GPX-Status versehen.
- 26 Arbeitsprotokolle in `batch-01-2026-11-17.json` bis `batch-26-2026-11-17.json`.
- 59 direkte `.gpx`-Download-URLs in den Streckendaten hinterlegt. Davon sind 53 als direkte Veranstalter-/Download-Links markiert; 6 bleiben Kandidaten, historische Dateien oder benötigen eine zusätzliche Prüfung.
- Weitere offizielle Veranstalter- und UTMB-Rennseiten mit Karten-/GPX-Export sind direkt bei den Strecken hinterlegt.

## Qualitätsregeln

1. Nur Veranstalterseiten, offizielle UTMB-Rennseiten und dort verlinkte Kursdateien gelten als offizielle Quelle.
2. Dateien mit falschem Editionsjahr (z. B. 2025/2026 statt 2027) werden nicht als aktuelle Strecke importiert.
3. Wenn der Veranstalter GPX erst später freigibt, wird der Status als ausstehend markiert und die offizielle Seite verlinkt.
4. Wenn ein direkter Dateilink nicht öffentlich auslesbar ist, wird die offizielle Karte/Map+GPX-Seite verlinkt, statt einen Dateipfad zu erraten.
5. Bei gesperrter Weitergabe oder privaten Strecken wird keine GPX-Datei in das Repository kopiert.

## Import in der App

Bei direkten `.gpx`-URLs zeigt die Streckendetailansicht die Schaltfläche **„GPX in Streckenkarte übernehmen“**. Die App lädt die Datei, parst GPS-Punkte und Höhenwerte und speichert sie lokal für die jeweilige Strecke. Falls der Veranstalterserver den Browserzugriff per CORS blockiert, kann die GPX-Datei über den Download-Link geladen und anschließend über **„Daten ergänzen / bearbeiten“ → „GPX-Datei für Höhenprofil“** manuell importiert werden.

## Einschränkung

Die GPX-Dateien werden überwiegend direkt vom Veranstalterserver geladen und nicht als Binärdateien in dieses Repository kopiert. Die automatische Browser-Importfunktion ist implementiert, aber der Laufzeittest muss in Safari bzw. im Browser der App noch für jede Quelle erfolgen. Eine verlinkte Datei ist deshalb nicht automatisch als erfolgreich importiert zu verstehen.
