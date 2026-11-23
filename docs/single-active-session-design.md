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
