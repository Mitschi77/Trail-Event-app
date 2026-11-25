# Garmin- und Strava-Integration – technische Architektur

Status: Entwurf / Draft PR. Keine Provider-Verbindung ist aktiv. Keine Secrets, OAuth-Clients oder Datenbankänderungen wurden eingerichtet.

## Ziel

Garmin Connect und Strava sollen als optionale Datenquellen in den Trailrunning-Manager integriert werden. Beide liefern Aktivitäten an einen gemeinsamen Importprozess. Die App bleibt die führende Stelle für persönliche Laufhistorie, Sportjahr, manuelle Korrekturen, Wettkampfergebnisse und Event-/Streckenzuordnung.

Die vorhandenen Dateiimporte (FIT, TCX, GPX) bleiben erhalten und werden nicht durch API-Verbindungen ersetzt.

## Was die offiziellen Anbieter aktuell erlauben

### Strava

- REST API mit OAuth 2.0; Nutzer autorisieren die App auf der Strava-Seite.
- Die App benötigt nur die tatsächlich verwendeten Scopes. Für den geplanten Import ist zunächst lesender Aktivitätszugriff ausreichend.
- Access Tokens sind kurzlebig; Refresh Tokens müssen serverseitig verwaltet und bei Rotation atomar ersetzt werden.
- Neue Anwendungen starten im Single-Player-Modus (nur das eigene Konto). Die offizielle Dokumentation nennt eine Strava-Mitgliedschaft als Voraussetzung zum Erstellen einer API-Anwendung.
- Erweiterter Zugriff beginnt mit einer begrenzten Athletenkapazität; für mehr Nutzer ist eine Prüfung durch Strava erforderlich.
- Webhooks sind für Aktivitätsänderungen und Deautorisierung der bessere Mechanismus als aggressives Polling. Rate Limits müssen beachtet werden.
- Strava hat für den 4. Januar 2027 eine neue API-Basis-URL angekündigt. Die Basis-URL darf deshalb nicht an mehreren Stellen hart codiert werden.

Offizielle Dokumentation:
- https://developers.strava.com/docs/getting-started/
- https://developers.strava.com/docs/authentication/
- https://developers.strava.com/docs/rate-limits/
- https://developers.strava.com/docs/changelog/

### Garmin Connect

Garmin unterscheidet zwischen persönlicher Nutzung und einer Mehrnutzer-/Business-Integration:

- Personal API: für die eigenen Garmin-Connect-Daten eines einzelnen Nutzers. Die Einrichtung erfolgt über Garmin Connect und einen persönlichen API-Key; Daten werden per Pull abgerufen. Diese Variante ist nicht für eine kommerzielle Mehrnutzer-App gedacht.
- Business Starter: Organisationszugang mit Activity API und weiteren APIs; Aktivitätsdaten werden per Push geliefert, historische Daten sind laut Programmübersicht nicht enthalten und die Nutzerkapazität ist begrenzt.
- Enterprise: kann Push oder Ping/Pull, historische Daten und größere Nutzerzahlen umfassen; Freigabe und Konditionen legt Garmin fest.
- Die Activity API kann Aktivitätszusammenfassungen sowie FIT-Dateien bereitstellen. Vollständige Detaildaten sind vom freigegebenen Programmumfang abhängig.

Offizielle Dokumentation:
- https://developer.garmin.com/gc-developer-program/overview/
- https://developer.garmin.com/gc-developer-program/enterprise/activity-api/
- https://developer.garmin.com/gc-developer-program/enterprise/program-faq/
- https://support.garmin.com/en-US/?faq=HfTwLfw1Gn2A7WS1GdAMH8

## Zielarchitektur

```
Strava OAuth / Garmin API oder Garmin Push
                  |
          Supabase Edge Functions
                  |
       Provider-spezifische Adapter
                  |
       Gemeinsames Import-Normalformat
                  |
        Deduplizierung + Konfliktprüfung
                  |
     Vorschau / Nutzer bestätigt Import
                  |
      persönliche Aktivitäten / Sportjahr
```

### Provider-Adapter

Jeder Anbieter bekommt einen eigenen Adapter. Die UI und die Sportjahr-Logik kennen keine Provider-spezifischen API-Felder.

Ein normalisierter Aktivitätsdatensatz soll mindestens enthalten:

- `provider`: `strava` oder `garmin`
- `provider_activity_id`: stabile externe Aktivitäts-ID als Text (keine 32-bit-Zahl)
- `sport_code`, `title`, `started_at` inklusive Zeitzone
- `duration_seconds`, `distance_km`, `elevation_gain_m`
- optionale Daten wie Herzfrequenz, Kalorien, GPS-/FIT-Datei nur nach expliziter Nutzerentscheidung und soweit der Providerzugang sie bereitstellt
- `raw_metadata` nur minimal und ohne Tokens oder unnötige personenbezogene Daten

Die Importnormalisierung muss dieselben Einheiten und Validierungen wie das Sportjahr-Modell verwenden. Segmentdaten (z. B. Triathlon-Schwimmen/Rad/Laufen und T1/T2) werden als Bestandteile einer Aktivität behandelt, niemals als zusätzliche Aktivitäten.

## Duplikat- und Konfliktregeln

1. API-Importe werden anhand des zusammengesetzten Schlüssels (Nutzer, Provider, externe Aktivitäts-ID) erkannt.
2. Dateiimporte behalten den vorhandenen SHA-256-Dateifingerprint.
3. Provider-Duplikate (z. B. dieselbe Garmin-Aktivität zusätzlich in Strava) benötigen zusätzlich eine vorsichtige Zeit-/Distanz-/Sportart-Abgleichsregel. Ein Treffer wird zunächst als möglicher Doppelimport markiert, nicht automatisch gelöscht.
4. Bestehende manuelle Werte, Event-/Streckenzuordnung, Platzierung, DNF-Status, Backyard-Runden und Bewertung dürfen niemals still überschrieben werden.
5. Import zunächst als Vorschau mit Auswahl; Nutzer kann Datensätze übernehmen, überspringen oder als getrennte Aktivität behalten.
6. Provider-Synchronisation schreibt standardmäßig nicht zurück zu Garmin oder Strava.

## Daten- und Sicherheitsschutz

- OAuth-Codeaustausch, Token-Erneuerung, Provider-API-Aufrufe und Webhook-Verarbeitung laufen ausschließlich serverseitig in Supabase Edge Functions.
- Client-Secrets, Garmin API Keys sowie Access-/Refresh-Tokens dürfen weder in Browser-Code noch in GitHub-Commits, Build-Artefakte oder Logs gelangen.
- Token-Datensätze müssen nutzergebunden und verschlüsselt gespeichert werden. Zugriff nur über serverseitige Funktionen; niemals über eine allgemein lesbare Tabelle.
- RLS muss jede Verbindung und jeden Importdatensatz strikt auf `auth.uid()` begrenzen. Service-Role-Secrets bleiben ausschließlich in Supabase Function Secrets.
- OAuth `state` muss zufällig, kurzlebig und an die angemeldete Sitzung gebunden sein; Callback-URLs und erlaubte Origins sind fest zu konfigurieren.
- Trennen der Verbindung muss Provider-Widerruf unterstützen, Tokens löschen und den Verbindungsstatus aktualisieren. Ob bereits importierte Aktivitäten erhalten bleiben oder gelöscht werden, entscheidet der Nutzer.
- Webhooks müssen Signatur/Challenge prüfen, Wiederholungen idempotent verarbeiten und dürfen niemals allein aufgrund einer fremden User-ID Daten schreiben.
- Keine Gesundheits- oder Trainingsdaten in Logs, Analytics oder Fehlermeldungen ausgeben.

## Geplante App-Oberfläche

Ort: **Daten & Verwaltung → Verbindungen**

Je Anbieter eine kompakte Verbindungskarte:
- Status: Nicht verbunden / Verbindung ausstehend / Verbunden / Erneute Anmeldung nötig / Zugriff widerrufen
- Aktion: Verbinden, Synchronisieren, Verbindung trennen
- Letzter erfolgreicher Abruf und Anzahl neu erkannter Aktivitäten
- Importumfang und Datenschutzoptionen
- Konflikte/Dubletten in einer Prüfliste

Die Oberfläche zeigt keine grünen Erfolgsflächen im NORTHBOUND-Design. Statusfarben und Hinweise folgen dem bestehenden Designstandard.

## Umsetzung in Phasen

### Phase 0 – jetzt (dieser Entwurf)

- Architektur, Datenfluss, Sicherheitsanforderungen und Provider-Beschränkungen dokumentieren.
- Keine Datenbankmigration ausführen.
- Keine Supabase-Secrets setzen.
- Keine Provider-App registrieren und keine Tokens anfordern.

### Phase 1 – Strava Einzelkonto-Test

Voraussetzungen:
- Betreiber legt eine Strava-API-Anwendung im eigenen Strava-Konto an.
- Client-ID, Client-Secret und Callback-Domain werden ausschließlich in Supabase Function Secrets konfiguriert.
- OAuth-Callback, minimale Read-Scopes, Tokenrotation, Deautorisierung und ein manueller Import werden mit einem Testkonto geprüft.
- Neue App bleibt zunächst Single-Player; keine Mehrnutzerfreigabe behaupten.

### Phase 2 – Garmin

- Für den persönlichen Test zuerst Garmins offizielle Personal API prüfen und deren Bedingungen beachten.
- Für eine App mit mehreren Nutzern Business Starter/Enterprise-Zugang bei Garmin beantragen. Erst nach Freigabe den passenden Push-/Pull-Adapter umsetzen.
- FIT-Dateiimport bleibt Fallback und manuelle Alternative.

### Phase 3 – gemeinsame Synchronisation

- Providerübergreifende Dublettenprüfung, Importvorschau, Konfliktauflösung, Webhooks/Push und Wiederholungs-/Fehlerbehandlung.
- Zwei-Konten-RLS-Tests und vollständige Trenn-/Löschtests.
- Erst nach expliziter Freigabe produktive Datenbankmigrationen und Deployments.

## Abnahmekriterien

- Kein Token und kein Client-Secret im Frontend, Repository, Build oder Log.
- Ein Provider-Datensatz wird pro Nutzer und Provider-ID nur einmal importiert.
- Dieselbe Aktivität aus zwei Quellen wird als möglicher Konflikt sichtbar, nicht still zusammengeführt.
- Manuelle Eventzuordnung, Resultate, DNF, Backyard-Runden und Bewertungen bleiben erhalten.
- Zeitzonen, Sommerzeit, Mitternachtswechsel, fehlende Höhenmeter und Nullwerte sind getestet.
- OAuth-Widerruf, abgelaufene/rotierte Refresh Tokens und wiederholte Webhooks sind getestet.
- Nutzer kann Verbindung und optionale importierte Rohdaten löschen.
- Alle Datenbankzugriffe sind durch RLS auf den jeweiligen Nutzer beschränkt.

## Offene Voraussetzungen

- Strava API-App und passende Freigabe durch den Betreiber.
- Garmin Personal API Key für den persönlichen Test bzw. Garmin Business Program Freigabe für Mehrnutzerbetrieb.
- Bestätigte Supabase-Projektkonfiguration und Callback-Domain.
- Entscheidung, ob GPS-/FIT-Rohdaten gespeichert werden sollen (Standard: nein).
