# Ein-Gerät-Anmeldung – technische Vorprüfung

Status: Entwurf / nicht produktiv
Stand: 2026-11-23
Zielzweig: feat/single-active-session-design

## Zielbild

Je Benutzerkonto ist genau eine Supabase-Auth-Sitzung für den Zugriff auf private Planungsdaten aktiv. Eine erfolgreiche Anmeldung auf einem zweiten Gerät macht die vorherige Sitzung für Cloud-Lese- und Schreibzugriffe ungültig. Lokale Daten auf dem abgemeldeten Gerät bleiben erhalten und werden nicht automatisch gelöscht.

## Rahmenbedingungen

- Supabase-Organisation und Projekt laufen im Free-Tarif.
- Supabase „Single session per user“ ist für diesen Tarif nicht verfügbar.
- Keine kostenpflichtige Testinstanz und kein kostenpflichtiger Tarifwechsel.
- Keine Migration, RLS-Änderung, Edge-Function-Bereitstellung oder sonstige Produktionsänderung im Rahmen dieser Vorprüfung.
- PR #275 bleibt Draft und wird von diesem Vorhaben nicht verändert.
- Der bestehende Zwei-Geräte-Konfliktcode wird nicht entfernt, bevor die neue Lösung nachweislich funktioniert.

## Befund aus dem bestehenden Projekt

- `public.planner_data` enthält `user_id`, `data` (jsonb) und `updated_at`.
- Die vier vorhandenen RLS-Regeln für `planner_data` prüfen derzeit nur `auth.uid() = user_id`.
- `public.event_push_subscriptions` hat ebenfalls benutzerbezogene RLS-Regeln, die aktuell nur `auth.uid() = user_id` prüfen.
- Im JWT steht die Claim `session_id` zur Verfügung.
- `auth.sessions` enthält mindestens `id`, `user_id`, `created_at`, `updated_at`, `not_after` und `refreshed_at`.
- Der bestehende Login ruft `signInWithPassword` auf und danach `activateCloudUser(user)`. Eine aktive Sitzungsprüfung gibt es dort bislang nicht.
- Die bisherige RLS-Prüfung allein über `auth.uid()` sperrt ein bereits ausgestelltes JWT eines alten Geräts nicht unmittelbar.

## Vorgeschlagener Sicherheitsentwurf

1. Nach dem Login liest die App die `session_id` aus der von Supabase gelieferten Sitzung.
2. Ein eng begrenzter RPC registriert die neue Sitzung als aktive Sitzung des Benutzers.
3. Der RPC darf nur die eigene `auth.uid()` und die eigene `session_id` verwenden. Er darf eine ältere Sitzung nicht reaktivieren. Vor dem Speichern muss serverseitig geprüft werden, dass die übergebene Sitzung noch zur aktuellen Auth-Sitzung gehört und keine neuere Anmeldung vorliegt.
4. Eine SECURITY-DEFINER-Prüffunktion mit festem `search_path` vergleicht bei jedem RLS-Zugriff die JWT-Claim `session_id` mit dem serverseitig gespeicherten aktiven Wert. Die aktive Sitzungsregistrierungstabelle ist für direkte Client-Lese- und Schreibzugriffe gesperrt.
5. Die Prüfung wird restriktiv auf private Planungsdaten und weitere benutzerbezogene Tabellen angewandt. Die vollständige Tabellen- und Policy-Inventur ist vor einer Migration zu vervollständigen.
6. Bei Ablehnung stoppt die App Cloud-Synchronisierung und Schreibwarteschlangen, sichert lokale Daten und zeigt einen eindeutigen Hinweis: „Diese Sitzung wurde beendet, weil du dich auf einem anderen Gerät angemeldet hast. Deine lokalen Daten bleiben auf diesem Gerät erhalten.“
7. Ein abgemeldetes Gerät darf nicht automatisch lokale Änderungen verwerfen oder ungefragt wieder in die Cloud hochladen.

## Offene technische Prüfungen vor Implementierung

- Supabase-Auth-Semantik der Tabelle `auth.sessions`: Löschung/Widerruf, Aktualisierung, Sortierung und Verhalten bei parallelen Logins anhand aktueller Dokumentation und Tests verifizieren.
- Race Condition: Zwei nahezu gleichzeitige Logins dürfen nicht dazu führen, dass ein älteres Gerät die aktive Sitzung überschreibt. Die Registrierung muss serverseitig serialisiert und gegen die tatsächlich jüngste gültige Auth-Sitzung geprüft werden.
- Token-Claim: `session_id` muss bei Password-Login, Refresh und erneutem Laden zuverlässig vorhanden sein.
- RLS-Funktionsrechte: Ausführung für `authenticated` erlauben, direkte Tabellenrechte verweigern; keine Service-Role-Geheimnisse im Browser.
- Tabelleninventur: alle privaten Tabellen, Storage-Policies, RPCs und Edge Functions auf weitere direkte Schreib-/Lesewege prüfen.
- Push-Benachrichtigungen: Geräte-Push-Abos getrennt vom aktiven Planungszugriff behandeln und prüfen, ob sie geräteübergreifend weiterbestehen sollen.
- Bestehende lokale Offline-Änderungen müssen exportierbar bzw. lokal gesichert bleiben.

## Mindesttests

1. iPhone anmelden, danach iPad anmelden: iPhone verliert Cloud-Lese- und Schreibzugriff.
2. iPad anmelden, danach iPhone anmelden: iPad verliert Cloud-Lese- und Schreibzugriff.
3. Altes Gerät mit noch nicht abgelaufenem JWT: direkte SELECT-, INSERT-, UPDATE- und DELETE-Versuche werden durch RLS abgewiesen.
4. Altes Gerät offline halten und später wieder verbinden: kein stilles Überschreiben; lokale Daten bleiben erhalten.
5. Zwei nahezu zeitgleiche Logins: genau eine Sitzung gewinnt; keine ältere Sitzung kann sich nachträglich aktiv setzen.
6. Seite neu laden / Token refresh: aktive Sitzung bleibt aktiv; alte Sitzung bleibt gesperrt.
7. Lokaler Logout: Verhalten bleibt korrekt und löscht keine fremden lokalen Kontodaten.
8. Event-Vorschläge, private Dokumente, Push-Abos und Edge Functions: Zugriffswege separat prüfen.

## Freigabekriterien

- Migration und RLS-Änderungen sind auf einer kostenlosen, isolierten Umgebung oder durch reproduzierbare lokale Tests validiert.
- Keine Datenverluste in Offline- und Kontowechsel-Szenarien.
- Node-/SQL-/Regressionstests erfolgreich.
- Echter iPhone-/iPad-Test durch den Benutzer erfolgreich.
- Erst danach separate Freigabe für Produktionsmigration und Veröffentlichung.

## Aktueller Stand

Nur diese technische Vorprüfungsnotiz liegt auf dem Entwicklungszweig. Es wurden keine App-Dateien geändert, keine Datenbankobjekte angelegt oder verändert und keine Edge Functions bereitgestellt.

## Erweiterte Bestandsaufnahme: weitere Zugriffswege

### Öffentliche Tabellen und RLS

- `event_change_proposals`
  - SELECT: Eigentümerkonto oder jeweiliger Einreicher.
  - INSERT: angemeldete Nutzer dürfen eigene Vorschläge im Status `pending` einreichen.
  - UPDATE: ausschließlich das fest konfigurierte Eigentümerkonto; Status und Entscheidungsfelder werden zusätzlich eingeschränkt.
  - Diese drei Zugriffspfade müssen bei einer Ein-Gerät-Sitzung jeweils zusätzlich die aktive Sitzung prüfen. Der Eigentümerzugriff darf nicht allein über eine feste User-ID privilegiert bleiben.
- `event_push_rate_limits`
  - Enthält Caller-ID und Sendezeitpunkt.
  - Keine direkte Client-RLS-Policy in der abgefragten Policy-Liste sichtbar; Zugriff erfolgt über die SECURITY-DEFINER-Funktion `claim_event_push_rate_limit`.
  - RPC-Berechtigungen und Aufruferprüfung müssen separat geprüft werden.
- `planner_data`: vier getrennte SELECT/INSERT/UPDATE/DELETE-Regeln, derzeit nur mit `auth.uid() = user_id`.
- `event_push_subscriptions`: eine ALL-Regel, derzeit nur mit `auth.uid() = user_id`.

### Storage

- Ein privater Bucket `trail-private-documents` ist vorhanden.
- Vier Policies auf `storage.objects` erlauben SELECT, INSERT, UPDATE und DELETE, wenn der erste Pfadbestandteil der eigenen User-ID entspricht.
- Diese Pfadprüfung bindet Dateien an ein Konto, aber nicht an dessen aktuell gültige Sitzung.
- Alle vier Regeln müssen zusätzlich die aktive Sitzung prüfen. Der Bucket bleibt privat; Service-Role-Funktionen müssen ihre Benutzerberechtigung separat prüfen.

### Datenbankfunktionen

Die Bestandsaufnahme fand unter anderem folgende öffentliche Funktionen:

- `claim_event_push_rate_limit(uuid)` – SECURITY DEFINER.
- `get_trail_push_vapid_config()` – SECURITY DEFINER.
- `ingest_event_change_proposals(jsonb)`.
- `mark_event_proposal_published(uuid,text)`.
- Triggerfunktionen zum Schutz von Vorschlägen und Planner-Daten.

Für jede SECURITY-DEFINER-Funktion sind Ausführungsrechte, fester `search_path`, Eingabevalidierung und mögliche Umgehung der aktiven Sitzung zu prüfen. Insbesondere dürfen Funktionen, die privilegierte Änderungen vornehmen, nicht als alternativer Weg an der Sitzungsprüfung vorbeiführen.

### Aktive Edge Functions und Konsequenzen

Zum Prüfzeitpunkt sind folgende Funktionen aktiv:

- `inspect-event-website` – JWT-Prüfung aktiviert; reine Website-Auswertung, aber Authentifizierungs- und Missbrauchsschutz weiterhin kontrollieren.
- `migrate-personal-documents` – JWT-Prüfung aktiviert; liest Nutzeridentität und verwendet danach Service Role für private Storage-Uploads. Die Sitzung muss vor dem privilegierten Upload aktiv validiert werden.
- `send-event-review-push` – JWT-Prüfung aktiviert; prüft den Nutzer, liest Vorschläge und Push-Abos über Service Role und versendet Benachrichtigungen. Für Benutzeraufrufe ist eine aktive Sitzungsprüfung vor jedem privilegierten Schritt nötig. Interne Service-Role-Aufrufe müssen als eigener, eng begrenzter Serverpfad behandelt werden.
- `send-owner-test-push` – JWT-Prüfung aktiviert; vor privilegierten Push-Aktionen Sitzung und Eigentümerberechtigung prüfen.
- `delete-own-account` – JWT-Prüfung aktiviert; nutzt Service Role zur Bereinigung privater Dateien und zur Kontolöschung. Vor dem irreversiblen Vorgang muss die Sitzung serverseitig aktiv validiert werden.
- `ingest-event-date-proposals` – JWT-Prüfung deaktiviert, authentifiziert stattdessen GitHub Actions über OIDC/JWKS und erlaubt nur definierte Workflows auf `main`. Diese vertrauenswürdige Automationsidentität ist kein Geräte-Login und darf nicht von der Benutzer-Sitzungsregistrierung abhängig gemacht werden. Die bestehende OIDC-Prüfung muss unverändert erhalten bleiben.

Die Bestandsaufnahme der Funktionsnamen und Policies ist noch keine vollständige Codeprüfung jeder Funktion. Vor Implementierung müssen die vollständigen Quelltexte aller sechs aktiven Funktionen sowie die zugehörigen SQL-Migrationen und RPC-Grants einzeln geprüft werden.

## Architekturergänzung

- Ein gemeinsamer SQL-Prüfbaustein muss von allen privaten Tabellen- und Storage-Policies verwendet werden.
- Edge Functions, die Service Role einsetzen, benötigen eine explizite aktive Sitzungsvalidierung anhand des vom Client gelieferten JWT. Die Identität darf nicht aus dem Request-Body übernommen werden.
- Interne Automationsaufrufe mit GitHub-OIDC oder streng kontrolliertem Server-zu-Server-Geheimnis bleiben getrennte Vertrauensdomänen.
- Push-Zustellung selbst kann zeitlich verzögert sein; das ändert nicht die Berechtigung, die App-Daten zu lesen oder zu schreiben.
- Die Sitzungsregistrierung muss atomar und gegen parallele Logins geschützt werden. Ein Client darf nicht selbst eine beliebige Sitzungs-ID als aktiv setzen können.

## Ergänzte Abnahmetests

9. Alte Sitzung kann keine Event-Vorschläge mehr lesen, einreichen oder entscheiden.
10. Alte Sitzung kann private PDFs weder auflisten noch herunterladen, hochladen, ersetzen oder löschen.
11. Alte Sitzung kann Push-Abos nicht mehr lesen oder verändern und keine privilegierten Push-Funktionen auslösen.
12. Service-Role-Edge-Functions lehnen Benutzer-JWTs mit veralteter Sitzungs-ID ab, bevor sie privilegierte Aktionen ausführen.
13. GitHub-OIDC-Automation für Event-Vorschläge funktioniert weiterhin unabhängig von Geräte-Logins.
14. Eigentümer- und Einreicherrechte bleiben inhaltlich unverändert, sind aber zusätzlich an die aktive Sitzung gebunden.

## Aktuelle Supabase-Dokumentation und Auth-Schema-Prüfung

Am 23.11.2026 wurde die aktuelle Supabase-Dokumentation zu User Sessions geprüft:

- Jeder Supabase-Auth-Access-Token enthält `session_id`; die ID entspricht dem Primärschlüssel in `auth.sessions`.
- Die eingebaute Einstellung „Single session per user“ ist laut Dokumentation nur für Pro-Pläne und höher verfügbar.
- Die eingebaute Einstellung wirkt bei der nächsten Session-Erneuerung, nicht proaktiv beim Speichern der Einstellung. Die JWT-Laufzeit kommt zur Verzögerung hinzu.
- Supabase empfiehlt keine JWT-Laufzeit unter fünf Minuten; der Standardwert von einer Stunde ist für viele Anwendungen vorgesehen.

Dokumentation: https://supabase.com/docs/guides/auth/sessions

### Tatsächliche Struktur von auth.sessions im Projekt

Die read-only Schemaabfrage ergab:

`id uuid NOT NULL`
`user_id uuid NOT NULL`
`created_at timestamptz NULL`
`updated_at timestamptz NULL`
`factor_id uuid NULL`
`aal USER-DEFINED NULL`
`not_after timestamptz NULL`
`refreshed_at timestamp NULL`
`user_agent text NULL`
`ip inet NULL`
`tag text NULL`
`oauth_client_id uuid NULL`
`refresh_token_hmac_key text NULL`
`refresh_token_counter bigint NULL`
`scopes text NULL`

Es wurden keine Sitzungszeilen oder personenbezogenen Werte aus `auth.sessions` ausgelesen.

### Konsequenz für den eigenen Sitzungswächter

- Die Registrierung muss die JWT-Claim `session_id` verwenden und darf keine frei wählbare Session-ID aus dem Request-Body akzeptieren.
- Vor der Aktivierung muss die ID in `auth.sessions` für `auth.uid()` existieren.
- Ein transaktionsweiter Lock pro Benutzer muss parallele Registrierungen serialisieren.
- Zusätzlich muss die Registrierung sicherstellen, dass keine neuere Auth-Sitzung existiert. Ein bloßer „last request wins“-Upsert wäre unsicher: Ein verspäteter Request des älteren Geräts könnte sonst die neuere Sitzung überschreiben.
- `created_at` ist nullable. Gleichstände bzw. fehlende Werte dürfen nicht durch eine willkürliche UUID-Sortierung als sichere zeitliche Reihenfolge interpretiert werden. Solche Fälle müssen fail-closed behandelt oder durch eine verlässlichere serverseitige Reihenfolge gelöst werden.
- Die Prüfung muss bei jedem privaten Datenzugriff erfolgen, nicht nur beim Login. Ein bereits ausgestelltes JWT des alten Geräts bleibt sonst bis zum Ablauf seiner Gültigkeit nutzbar.

### Noch nicht entschiedene Architekturfrage

Es ist noch nicht bestätigt, ob das aktive Supabase-Projekt einen Pro-Plan oder höher verwendet. Die eingebaute Einstellung kann daher noch nicht als verfügbar vorausgesetzt werden. Die eigene Sitzungsprüfung wird unabhängig davon als notwendige zweite Schutzschicht betrachtet.

### Nicht ausgeführt

Diese Dokumentation beschreibt den Entwurf. Es wurde weder eine Migration erstellt noch SQL ausgeführt, keine Policy verändert und keine Edge Function bereitgestellt. Die vorhandenen Auth- und Datenbankobjekte bleiben unverändert.

