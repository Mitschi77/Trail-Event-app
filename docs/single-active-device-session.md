# Ein aktives Gerät pro Benutzer – kostenlose Zwischenlösung

## Ziel und Verhalten

Die App verwendet vorläufig die Supabase-Auth-Sitzungen statt einer eigenen Geräte-Konfliktauflösung:

1. Bei einer ausdrücklichen E-Mail-/Passwort-Anmeldung wird nach erfolgreicher Anmeldung `auth.signOut({ scope: "others" })` ausgeführt.
2. Die gerade angemeldete Sitzung bleibt aktiv; alle anderen Auth-Sitzungen desselben Kontos werden widerrufen.
3. Supabase sendet bei `signOut({ scope: "others" })` kein direktes `SIGNED_OUT`-Ereignis an die anderen Geräte. Deshalb prüft das bisherige Gerät die Session-RPC beim Cloud-Polling; sobald die widerrufene Sitzung erkannt wird, stoppt die App den Polling-Timer und zeigt an, dass lokale Daten erhalten bleiben, aber nicht mehr synchronisiert werden. Ein zusätzlicher Token-Refresh kann ebenfalls den Widerruf erkennen.
4. Die lokalen Daten des abgemeldeten Geräts werden nicht automatisch gelöscht.

Ein automatischer App-Neustart mit einer bereits gespeicherten Sitzung darf **nicht** `signOut({ scope: "others" })` ausführen. Sonst könnte ein altes Gerät beim bloßen Öffnen die neuere Anmeldung wieder verdrängen. Deshalb wird die Abmeldung anderer Sitzungen ausschließlich an den expliziten Passwort-Login gebunden.

## Schutz bereits ausgestellter JWTs

Supabase dokumentiert, dass ein bereits ausgegebenes Access-Token nach dem Widerruf bis zum Ablauf seines JWT noch gültig sein kann. Deshalb reicht die Abmeldung der Refresh-Sitzungen allein nicht aus.

Die Migration ergänzt:

- `private.is_current_auth_session_active()`: prüft, ob die `session_id` des aktuellen JWT noch in `auth.sessions` existiert und zum angemeldeten Benutzer gehört.
- `public.is_current_auth_session_active()`: parameterlose, nur für `authenticated` ausführbare RPC-Fassade für Edge Functions. Sie gibt ausschließlich den Status der aktuellen aufrufenden Sitzung zurück.
- RLS-Prüfungen für `planner_data`, den privaten PDF-Bucket `trail-private-documents`, `event_push_subscriptions` und `event_change_proposals`.

Damit kann ein altes, noch nicht abgelaufenes JWT diese geschützten Daten nicht mehr lesen oder verändern, sobald seine Auth-Sitzung entfernt wurde.

## Edge Functions

Die serverseitigen Funktionen, die privilegierte Service-Role-Aktionen ausführen, müssen zusätzlich die parameterlose RPC mit dem ursprünglichen Benutzer-JWT aufrufen. Im Branch ist das für folgende Funktionen vorgesehen:

- `send-event-review-push`
- `send-owner-test-push`
- `delete-own-account`
- `migrate-personal-documents` (die bisher aktive Funktion war nicht im Repository versioniert; dieser Branch ergänzt eine nachvollziehbare Quelldatei)

Eine reine `verify_jwt`-Prüfung reicht nicht, weil sie nur die JWT-Gültigkeit prüft und nicht zwingend die Existenz der Auth-Sitzung.

## Einschränkungen

- Die Supabase-Dashboard-Einstellung „Single session per user“ ist laut aktueller Supabase-Dokumentation Pro-Plan vorbehalten. Dieser Branch nutzt stattdessen die Auth-API-Funktion `signOut({ scope: "others" })`.
- Die App meldet das andere Gerät nicht zwingend in derselben Millisekunde ab. Der lokale Auth-Client erkennt den Widerruf beim Refresh; RLS und die RPC blockieren die oben geschützten Ressourcen bereits anhand der fehlenden Session-Zeile.
- Öffentliche Eventdaten bleiben öffentlich lesbar.
- Jede weitere Edge Function, die mit einem Benutzer-JWT privilegierte Aktionen ausführt, muss ebenfalls die Session-RPC prüfen. Die Funktion `inspect-event-website` ist aktuell nur ein öffentlicher Website-Parser und verändert keine Benutzerdaten.
- Die lokale Kopie auf dem abgemeldeten Gerät bleibt erhalten. Beim späteren erneuten Login muss der vorhandene Datenabgleich mögliche lokale Änderungen weiterhin schützen.

## Rollout-Reihenfolge – noch nicht ausgeführt

1. Migration in einer Testumgebung anwenden.
2. PostgreSQL-Integrationstest für aktive und widerrufene Sitzungen auf Planungsdaten, private Dokumente, Push-Abos und Änderungsvorschläge ausführen; zusätzlich fehlende Sitzungskennung, fremde Benutzer-Sitzung und das Rollback prüfen.
3. Edge-Function-Tests und Deno-Typechecks ausführen.
4. Rollback-Skript `supabase/rollback/20261123100000_single_active_device_session_rollback.sql` in der Testumgebung prüfen.
5. Login auf iPhone und anschließend auf iPad testen; prüfen, dass das iPhone keine geschützten Cloud-Daten mehr lesen oder schreiben kann.
6. Erst nach erfolgreicher Prüfung die Migration und App-Version gemeinsam veröffentlichen.

Das Rollback stellt die bisherigen RLS-Ausdrücke wieder her und entfernt die neuen RPC-Funktionen. Vor einem Rollback müssen App und Edge Functions auf Versionen zurückgesetzt oder so angepasst werden, dass sie die neue RPC nicht mehr aufrufen.

**Status dieses Branches:** Implementierungsvorschlag und Tests im Git-Branch. Keine Migration auf Supabase angewendet, keine Edge Function deployed, keine PR zusammengeführt und keine Live-App geändert.
