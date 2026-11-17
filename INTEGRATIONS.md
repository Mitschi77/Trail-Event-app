# Strava- und Garmin-Integration

## Bereits umgesetzt

- Strecken- und Höhenprofilimport aus GPX-Dateien.
- Zusätzlich werden Garmin-/Training-Center-XML-Dateien (TCX) eingelesen.
- Aus den Trackpunkten berechnet die App Distanz, Aufstieg, Abstieg, Streckenkarte und Höhenprofil.
- Die Dateien werden lokal in der Streckendatenpflege verarbeitet; es werden dafür keine Zugangsdaten zu Strava oder Garmin benötigt.

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

1. Für persönliche Nutzung kann Garmin einen persönlichen API-Zugang bereitstellen; die persönliche API ist auf Abruf (Pull) ausgerichtet.
2. Eine Integration für weitere Nutzer benötigt die Freigabe und den passenden Zugang des Garmin Connect Developer Program.
3. Garmin-Aktivitäten können als FIT/GPX/TCX-Dateien bereitgestellt werden. TCX-Import ist bereits vorbereitet; FIT-Import und die offizielle API-Anbindung sind separate Ausbauschritte.
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

- Strava-API-App mit Client-ID, Client-Secret und registrierter Callback-Domain durch den App-Betreiber.
- Garmin-Zugang bzw. schriftliche Freigabe für den beabsichtigten Nutzerkreis.
- Produktions-Callback-URLs, Supabase-Secrets und Token-Verschlüsselung konfigurieren.
- Import mit Testkonten prüfen: doppelte Aktivitäten, widerrufene Freigabe, abgelaufene Tokens, Zeitzonen, DNF/Mehrtagesevents und Löschung.