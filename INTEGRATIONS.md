# Strava- und Garmin-Anbindung

## Bereits verfügbar: Dateiimport

- Garmin FIT, Garmin/Training Center TCX und GPX werden unterstützt.
- Eine Aktivität kann in der Laufhistorie einem Event und einer Strecke zugeordnet werden.
- Übernommene Werte: Startdatum, Distanz, Höhenmeter, Dauer und – sofern in der FIT-Datei enthalten – durchschnittlicher/maximaler Puls sowie Kalorien.
- Eine Streckendatei kann außerdem direkt an einer Eventstrecke hinterlegt werden; daraus entstehen Streckenkarte und Höhenprofil.
- Der Import funktioniert ohne Strava- oder Garmin-Passwort und ohne API-Freischaltung.
- Wiederholte Importe werden anhand eines SHA-256-Dateifingerprints erkannt. Bereits manuell eingetragene Platzierung und Bewertung bleiben bei einer Ergänzung erhalten.

## Strava: direkte Verbindung

Technisch ist die Strava-API geeignet, um Aktivitäten nach Zustimmung des jeweiligen Nutzers zu lesen. Die Verbindung muss über OAuth 2.0 erfolgen. Die App erhält nur die freigegebenen Berechtigungen; Passwörter werden niemals in der Trail-App abgefragt.

**Einschränkungen für diese App:**

- Neue Strava-API-Anwendungen starten im Single-Player-Modus und können zunächst nur das eigene Konto verbinden.
- Für weitere Nutzer muss der Entwickler den passenden Zugriff im Strava-Dashboard beantragen. Die erste Erweiterung ist auf bis zu 10 Athleten begrenzt; für mehr Nutzer ist eine Strava-Prüfung erforderlich.
- Strava verlangt derzeit ein aktives Strava-Abo, um eine API-Anwendung zu erstellen.
- Strava-Client-Secret, Access- und Refresh-Tokens gehören ausschließlich in ein serverseitiges Backend, nicht in die App oder nach GitHub.

**Geplante Umsetzung:**

1. „Mit Strava verbinden“ startet den offiziellen OAuth-Ablauf.
2. Eine Supabase-Edge-Function tauscht den Autorisierungscode serverseitig gegen Tokens.
3. Aktivitäten werden nur mit Leseberechtigung abgerufen und anhand der Strava-Aktivitäts-ID dedupliziert.
4. Nutzer wählen, welche Läufe importiert und welchen Trail-Events sie zugeordnet werden.
5. Widerruf der Strava-Freigabe und Löschung der Tokens werden unterstützt.

## Garmin Connect: direkte Verbindung

Garmin unterscheidet klar zwischen persönlicher und geschäftlicher Nutzung:

- **Personal API:** für die eigenen Garmin-Daten eines einzelnen Nutzers; Abruf (Pull) ist möglich. Sie ist nicht für eine App mit mehreren Endnutzern gedacht.
- **Business Starter:** für Organisationen und begrenzte Nutzerzahlen; Aktivitätsdaten werden per Push bereitgestellt, historische Daten sind nicht enthalten.
- **Enterprise:** kann je nach Freigabe Push oder Ping/Pull und historische Daten ermöglichen; Zugang und Konditionen legt Garmin fest.

Für Freunde ist daher nicht der persönliche Garmin-API-Schlüssel des App-Betreibers zu verwenden. Eine direkte Mehrnutzer-Anbindung setzt eine passende Garmin-Business-Freigabe voraus. Bis dahin ist der Dateiimport der zuverlässige Weg: Garmin FIT/TCX exportieren und in der Trail-App importieren.

## Sicherheits- und Datenregeln

- Nur ausdrücklich freigegebene Daten importieren; standardmäßig keine Trainingsdaten an Anbieter zurückschreiben.
- Provider-Secrets und Tokens nur serverseitig speichern und verschlüsseln.
- Supabase-Zugriff mit Authentifizierung und Row Level Security strikt auf den jeweiligen Nutzer begrenzen.
- Verbindung jederzeit trennbar machen; Tokens widerrufen/löschen und dem Nutzer die Wahl lassen, ob importierte Aktivitäten ebenfalls entfernt werden.
- Externe Aktivitäts-IDs für API-Importe und Dateifingerprints für Dateiimporte zur Duplikaterkennung verwenden.
- Herzfrequenz, Kalorien und GPS-Tracks nur speichern, wenn der Nutzer den Import ausdrücklich auslöst.

## Offizielle Informationen

- Strava Getting Started: https://developers.strava.com/docs/getting-started/
- Strava OAuth: https://developers.strava.com/docs/authentication/
- Garmin Connect Developer Program: https://developer.garmin.com/gc-developer-program/overview/
- Garmin Personal API: https://developer.garmin.com/gc-developer-program/personal/personal-api/
- Garmin FIT SDK: https://developer.garmin.com/fit/get-the-sdk/

## Voraussetzungen für eine automatische Synchronisierung

1. Strava-API-App anlegen und den passenden Athletenzugriff freischalten lassen.
2. Garmin-Zugang für den gewünschten Nutzerkreis beantragen, falls eine direkte Garmin-Verbindung gewünscht ist.
3. OAuth-Callback-Domains und Supabase-Server-Secrets konfigurieren.
4. Mit Testkonten Import, Duplikaterkennung, widerrufene Freigaben, abgelaufene Tokens, Zeitzonen und Datenlöschung prüfen.