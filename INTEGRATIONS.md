# Strava- und Garmin-Integration

## Bereits umgesetzt

- Strecken- und Höhenprofilimport aus GPX-Dateien.
- Zusätzlich werden Garmin-/Training-Center-XML-Dateien (TCX) und native Garmin-FIT-Aktivitätsdateien eingelesen.
- Aus den Trackpunkten berechnet die App Distanz, Aufstieg, Abstieg, Streckenkarte und Höhenprofil.
- Dateien können in der Streckenpflege für Karte/Höhenprofil oder in der Laufhistorie als absolvierte Aktivität importiert werden. Für die Laufhistorie werden Startdatum, Distanz, Aufstieg und – soweit in der Datei enthalten – Laufzeit übernommen. Es werden dafür keine Zugangsdaten zu Strava oder Garmin benötigt.

## Zielbild für automatische Synchronisierung

Die Synchronisierung soll Aktivitäten importieren, nicht ungefragt Trainingsdaten an die Plattformen zurückschreiben.

### Strava

1. Nutzer startet „Mit Strava verbinden“.
2. Anmeldung und Zustimmung erfolgen über Stravas OAuth-Seite, nicht in einem eingebetteten Passwortformular.
3. Die App fordert nur Leserechte für Aktivitäten an.
4. Ein Supabase-Edge-Backend tauscht den Autorisierungscode aus und verwaltet Access-/Refresh-Tokens serverseitig.
5. Aktivitäten werden anhand der externen Aktivitäts-ID dedupliziert und als Laufhistorie übernommen.
6. Nutzer kann Zeitraum, Aktivitätstyp und Importumfang wählen und einzelne Importe rückgängig machen.

Strava-Client-Secret und Refresh-Tokens dürfen niemals in der App-Oberfläche, im Browser-Speicher oder in GitHub abgelegt werden.

### Garmin Connect

1. Garmin bietet eine Personal API für die eigenen Aktivitäten an (JSON und FIT, Abruf/Pull). Sie ist ausdrücklich für persönliche Nutzung gedacht und nicht für eine App mit mehreren Endnutzern.
2. Wenn Freunde ihre Garmin-Daten direkt verbinden sollen, ist der Garmin Connect Developer Program-Zugang für Organisationen erforderlich; Starter-Zugang ist auf Push-Übermittlung und begrenzte Nutzerzahlen ausgelegt. Umfangreichere Pull-/Historienfunktionen hängen von Enterprise-Zugang und Freigabe ab.
3. Garmin-Aktivitäten können als FIT/GPX/TCX-Dateien bereitgestellt werden. FIT-, TCX- und GPX-Dateiimport sind bereits eingebaut; die offizielle API-Anbindung ist ein separater Ausbauschritt.
4. Für eine öffentliche App müssen Garmin-Zugang, Datenumfang, Nutzungsbedingungen und Freigabe vor dem Start geklärt werden.

## Einheitliches Aktivitätsmodell

Für jeden importierten Lauf sollten mindestens gespeichert werden:

- Quelle (manual, strava, garmin, file)
- Externe Aktivitäts-ID und Importzeitpunkt
- Startzeit mit Zeitzone
- Distanz, Höhengewinn, Dauer und Aktivitätstyp
- Optional Herzfrequenz und GPX-/FIT-Streckenpunkte, nur wenn der Nutzer dies ausdrücklich freigibt
- Zugeordnete Veranstaltung/Strecke und Importstatus

Externe Aktivitäts-IDs verhindern doppelte Einträge bei wiederholter Synchronisierung. Ein manuell erfasster Lauf darf durch einen später importierten Datensatz nicht stillschweigend überschrieben werden.

## Sicherheits- und Datenschutzregeln

- OAuth ausschließlich über den offiziellen Anbieter-Flow.
- Provider-Secrets und Tokens ausschließlich serverseitig; verschlüsselte Speicherung und Zugriff nur über authentifizierte Edge Functions.
- Datenbankzeilen strikt an den angemeldeten Nutzer binden (RLS).
- Verbindung jederzeit trennbar; dabei Tokens widerrufen/löschen und importierte Daten nach Wahl des Nutzers behalten oder entfernen.
- Nur Datenfelder abrufen, die für Laufhistorie und Trainingsplanung benötigt werden.
- Vor Veröffentlichung Datenschutzhinweise und Anbieterbedingungen aktualisieren.

## Voraussetzungen vor dem Livegang

- Strava-API-App mit Client-ID, Client-Secret und registrierter Callback-Domain durch den App-Betreiber. Strava verlangt derzeit ein aktives Abo zum Erstellen der App; neue Apps starten im Einzelmodus und können im Dashboard zunächst auf bis zu 10 Athleten erweitert werden. Darüber hinaus ist eine Prüfung durch Strava erforderlich. Strava verlangt derzeit ein aktives Abo zum Erstellen der App; neue Apps starten im Einzelmodus und können im Dashboard zunächst auf bis zu 10 Athleten erweitert werden. Darüber hinaus ist eine Prüfung durch Strava erforderlich.
- Garmin-Zugang bzw. schriftliche Freigabe für den beabsichtigten Nutzerkreis.
- Produktions-Callback-URLs, Supabase-Secrets und Token-Verschlüsselung konfigurieren.
- Import mit Testkonten prüfen: doppelte Aktivitäten, widerrufene Freigabe, abgelaufene Tokens, Zeitzonen, DNF/Mehrtagesevents und Löschung.

## Current Strava access limitation

New Strava API apps start in single-player mode. A Strava subscription is required to create an API app. For friends to connect, the developer must request the appropriate access level (initially limited to 10 athletes) and comply with Strava review requirements before scaling. References: https://developers.strava.com/docs/getting-started/ and https://developers.strava.com/docs/authentication/.
