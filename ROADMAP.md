# Trail Events – Prüfbericht und Ausbauplan

Stand: 17. November 2026

## Bereits geprüft bzw. umgesetzt

- Laufhistorie: Rundenkilometer werden aus der Strecken-Rundenlänge statt aus einem festen Wert berechnet.
- Datumsvergleiche verwenden das lokale Kalenderdatum des Geräts, damit Rennen rund um Mitternacht/Zeitzonen nicht falsch einsortiert werden.
- Offizielle Eventtermine werden beim App-Start erneut geprüft.
- GPX- und TCX-Dateien können für Streckenkarte und Höhenprofil eingelesen werden.
- Garmin-FIT-Dateien können mit dem offiziellen Garmin FIT JavaScript SDK gelesen werden.
- FIT-/TCX-/GPX-Aktivitäten können einer Eventstrecke in der Laufhistorie zugeordnet werden; vorhandene manuelle Ergebnisse, Platzierungen und Bewertungen werden beim Ergänzen erhalten.
- Bei FIT-Import werden – soweit vorhanden – Distanz, Höhenmeter, Startzeit, Dauer, durchschnittlicher/maximaler Puls und Kalorien übernommen.
- Doppelte Dateiimporte werden anhand Datum, Dateiname und Dateigröße erkannt.
- GPX-Punkte ohne gültige Koordinaten werden verworfen.
- Syntax-/Feature-Regressionstests sind Teil der CI-Prüfung.

## Noch offen / bekannte Grenzen

- Die automatische Strava-OAuth-Verbindung ist noch nicht implementiert.
- Die automatische Garmin-Connect-Verbindung ist noch nicht implementiert. Der Dateimport ist unabhängig davon.
- Der FIT-Import wurde durch automatisierte Prüfungen und die SDK-Dokumentation abgesichert; ein echter Test mit einer Originaldatei von einem Garmin-Gerät steht noch aus.
- Ein vollständiger manueller iPhone-Test (Safari, Dateien-App, Home-Bildschirm, Cloud-Sync, Karten, Import) steht noch aus.
- Es gibt keinen Service Worker: Die App-Oberfläche ist nicht als vollständige Offline-App zwischengespeichert. Kartenkacheln benötigen ohnehin eine Verbindung.
- Ohne Cloud-Anmeldung bleiben persönliche Planungsdaten auf dem jeweiligen Gerät. Freunde können dieselbe App-Adresse verwenden, haben aber getrennte Daten.

## Empfohlene Reihenfolge

### Priorität 1 – Stabilität und Datensicherheit

1. Auf iPhone und Desktop die Kernabläufe testen: Eventsuche, Streckenauswahl, Jahresplanung, Regeneration, Laufhistorie, GPX/TCX/FIT-Import, Cloud-Synchronisierung und Backup-Wiederherstellung.
2. Testdateien für Garmin FIT, TCX und GPX mit bekannten Sollwerten hinterlegen; Distanz, Höhenmeter, Zeit, Zeitzone und Puls vergleichen.
3. Export/Import-Backup um Versionsnummer, Datum und verständliche Wiederherstellungsprüfung ergänzen.
4. Fehler- und Speicherzustände sichtbar machen: fehlgeschlagene Cloud-Synchronisierung, voller Gerätespeicher, fehlende Kartenverbindung und nicht lesbare Dateien.

### Priorität 2 – Trainingsauswertung

1. Trainingsübersicht mit Wochen-/Monatskilometern, Höhenmetern, Laufzeit und Anzahl der Läufe.
2. Belastungsübersicht vor geplanten Rennen: letzte 7/28/90 Tage, Höhenmeter und längster Lauf.
3. Herzfrequenz-, Pace- und Kalorienwerte aus FIT/TCX anzeigen, wenn die Datei diese Werte enthält.
4. Importvorschau vor dem Speichern: erkannte Aktivität, Datum, Strecke, Distanz, Höhenmeter, Zeit und Puls; Nutzer bestätigt die Zuordnung.
5. Mehrtägige Events, DNF und mehrere Aktivitäten am selben Tag korrekt unterstützen.

### Priorität 3 – Strava

1. OAuth 2.0 über Strava; nur Leseberechtigung für Aktivitäten anfordern.
2. Client-Secret und Tokens ausschließlich serverseitig in Supabase Edge Functions verwalten; niemals in Browser oder GitHub speichern.
3. Aktivitäten anhand externer Aktivitäts-ID deduplizieren und mit vorhandenen manuellen Läufen zusammenführen, ohne Resultat/Platz/Bewertung zu überschreiben.
4. Nutzer kann Zeitraum, Aktivitätstyp und einzelne Importe auswählen sowie Verbindung widerrufen.
5. Strava beginnt im Single-Player-Modus; das Erstellen einer API-App erfordert ein Strava-Abo. Der Zugang für weitere Athleten ist separat freizuschalten und kann eine Prüfung erfordern.

### Priorität 4 – Garmin Connect

1. Für den persönlichen Gebrauch kann Garmins Personal API die eigenen Aktivitäten bereitstellen; sie ist auf einzelne Nutzer ausgelegt und unterstützt Pull-Zugriff.
2. Für Freunde bzw. mehrere Nutzer ist der offizielle Garmin Connect Developer Program Zugang erforderlich; Starter/Enterprise-Zugang und Freigabe sind vorab zu klären.
3. Garmin FIT-Dateiimport bleibt als kostenlose und robuste Alternative erhalten.
4. Garmin API-Schlüssel und Tokens ausschließlich serverseitig verwalten; keine Zugangsdaten in die Web-App eingeben oder speichern.

### Priorität 5 – Bedienung und Komfort

1. Filter und Favoriten für Events, Länder, Distanzen und Höhenmeter.
2. Merkliste für interessante Rennen und Vergleich von bis zu drei Strecken.
3. Kalenderexport (ICS) für geplante Rennen und Anmeldetermine.
4. Erinnerungen an Anmeldestart, Zahlungsfristen und Cut-off-relevante Renninformationen.
5. Offline-fähige App-Oberfläche (ohne Offline-Kartenversprechen) und klarer Aktualisierungsstatus.
6. Mobile Bedienung weiter verbessern: größere Touch-Flächen, klare Ladeanzeigen, sichere Dialoge und barrierearme Beschriftungen.

## API- und Produktbedingungen

- Strava: https://developers.strava.com/docs/getting-started/
- Strava Rate Limits und Athletenkapazität: https://developers.strava.com/docs/rate-limits/
- Garmin Connect Developer Program: https://developer.garmin.com/gc-developer-program/overview/
- Garmin Personal API: https://developer.garmin.com/gc-developer-program/personal/personal-faq/
- Garmin FIT JavaScript SDK: https://github.com/garmin/fit-javascript-sdk

## Kostenbewusste Empfehlung

Die Web-App bleibt die Standardversion und kann ohne App-Store-Veröffentlichung von dir und Freunden über denselben Link verwendet werden. GPX/TCX/FIT-Dateiimport ist der erste Integrationsweg ohne Strava-/Garmin-API-Vertrag. Automatische Schnittstellen werden erst aktiviert, wenn die jeweiligen Zugänge, Kosten und Freigaben geklärt sind.