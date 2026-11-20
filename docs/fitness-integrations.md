# Garmin- und Strava-Anbindung

## Aktueller Stand

Der Eventplaner kann bereits absolvierte Aktivitäten über Garmin FIT/TCX und Strava-GPX-Dateien importieren. Eine direkte Kontosynchronisierung ist noch nicht freigeschaltet. Dafür fehlen die Anbieter-App-Registrierungen und die dafür notwendigen Zugangsdaten/Freigaben.

## Zielarchitektur

- Die GitHub-Pages-App startet die Autorisierung und zeigt den Verbindungsstatus.
- OAuth- und API-Geheimnisse liegen ausschließlich als Supabase Edge Function Secrets vor.
- Supabase Edge Functions übernehmen OAuth-Callback, Token-Austausch, Token-Erneuerung und API-Aufrufe.
- Tokens werden serverseitig und nutzergebunden gespeichert; Row Level Security schützt Datensätze.
- Aktivitäten werden anhand der Anbieter-ID dedupliziert und in das bestehende Aktivitäts-/Laufhistorienformat normalisiert.
- Strava-Webhooks sollen neue/geänderte Aktivitäten melden; kein aggressives Polling.
- Garmin-Aktivitäten werden über die zugelassene Garmin Personal API (nur persönlicher Nutzer) oder nach Freigabe über das Developer Program bezogen.

## Strava – benötigte Einrichtung

1. Eine Strava API Application registrieren: https://www.strava.com/settings/api
2. Client ID und Client Secret sicher verwahren.
3. OAuth 2.0 Authorization Code Flow verwenden; nur erforderliche Scopes anfordern (für private Aktivitäten ggf. `activity:read_all`).
4. Redirect-URI auf eine serverseitige Supabase Edge Function setzen, nicht auf einen Client-seitigen Secret-Austausch.
5. Webhook-Subscription und Deautorisierung gemäß Strava-Vorgaben implementieren.
6. API-Nutzungsgrenzen, Datenschutz- und Markenrichtlinien einhalten.

Offizielle Dokumentation:
- https://developers.strava.com/docs/authentication/
- https://developers.strava.com/docs/webhooks/
- https://developers.strava.com/docs/rate-limits/

## Garmin – benötigte Einrichtung

Für die private Einzelnutzung gibt es die Garmin Connect Personal API. Garmin stellt dafür einen persönlichen API-Key bereit; daraus wird ein OAuth-2.0-Zugriffstoken erzeugt. API-Key und Token dürfen nicht in Browser-Code oder GitHub gespeichert werden. Garmin Personal API ist für die eigenen Daten gedacht, nicht für eine Mehrbenutzer-App.

Für Freunde oder weitere Nutzer ist eine Freigabe über das Garmin Connect Developer Program erforderlich. Der Umfang (Starter/Enterprise), Datenhistorie und Zustellmodell richten sich nach Garmins Genehmigung und Vertrag.

Offizielle Dokumentation:
- https://developer.garmin.com/gc-developer-program/personal/
- https://support.garmin.com/en-US/?faq=HfTwLfw1Gn2A7WS1GdAMH8
- https://developerportal.garmin.com/developer-programs/connect-developer-api

## Noch benötigte Freigaben

- Strava: registrierte App, Client ID/Secret, bestätigte Redirect-URI und API-Zugriff.
- Garmin: persönlicher API-Key für die eigene Nutzung oder genehmigter Developer-Program-Zugang für mehrere Nutzer.
- Supabase: Edge Function Deployment, Secrets und Datenbankmigration für provider connections, verschlüsselte Tokens und Sync-Cursor.

Bis diese Punkte vorliegen, bleibt der vorhandene Dateiimport der sichere und funktionsfähige Weg. Es werden keine Zugangsdaten abgefragt oder in der App gespeichert.
