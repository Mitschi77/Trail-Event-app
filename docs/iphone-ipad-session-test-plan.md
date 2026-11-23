# iPhone-/iPad-Testplan: ein aktives Gerät pro Benutzer

## Zweck und Sicherheitsgrenze

Dieser Plan prüft die Ein-Gerät-Regel mit zwei echten App-Installationen und einem Testkonto. Er ist kein Nachweis durch den PostgreSQL-CI-Simulationstest: Dieser simuliert `auth.sessions`, aber nicht den echten Supabase-Auth-Ablauf von `signOut({ scope: "others" })`, Refresh-Tokens oder iOS-Hintergrundverhalten.

**Nur in einer isolierten Testumgebung ausführen.** Kein echtes Benutzerkonto, keine echten Buchungsbelege und keine produktiven Push-Abonnements verwenden. Die produktive Supabase-Datenbank bleibt unberührt.

## Voraussetzungen

- Separates Supabase-Testprojekt oder lokale Supabase-Instanz mit Auth, PostgREST, Storage und Edge-Functions-Runtime.
- Migration `20261123100000_single_active_device_session.sql` ausschließlich dort angewendet.
- Die vier geschützten Edge Functions aus demselben Branch als Testversion bereitgestellt.
- Zwei Geräte: iPhone und iPad, jeweils dieselbe Test-App-Version und dasselbe Testkonto.
- Testkonto mit eigenem Passwort und ausschließlich synthetischen Testdaten.
- Auf beiden Geräten Netzverbindung; Uhrzeit und App-Version dokumentieren.
- Vor Testbeginn einen Planner-Datensatz, ein PDF im Bucket `trail-private-documents`, ein Push-Abo und einen offenen Änderungsvorschlag für das Testkonto anlegen.

## Testfälle

| ID | Durchführung | Erwartetes Ergebnis |
|---|---|---|
| T01 | Auf dem iPhone explizit anmelden. | Anmeldung erfolgreich; Session-RPC liefert `true`; eigene Planungsdaten sind les- und schreibbar. |
| T02 | App auf dem iPad öffnen und mit demselben Konto explizit anmelden. | iPad bleibt angemeldet; andere Auth-Sitzung wird widerrufen. |
| T03 | Auf dem iPhone Cloud-Polling abwarten bzw. Sitzung aktualisieren. | Hinweis auf Abmeldung auf anderem Gerät erscheint; Cloud-Polling stoppt; lokale Daten bleiben erhalten. |
| T04 | Mit dem noch nicht abgelaufenen alten iPhone-Access-Token RPC und geschützte Tabellen direkt abfragen. | Session-RPC liefert `false`; RLS gibt keine fremd- bzw. geschützten Datensätze frei und verhindert Schreibzugriffe. |
| T05 | Mit dem widerrufenen iPhone-Token private Dateien, Push-Abos und Änderungsvorschläge abfragen. | Kein Zugriff auf die geschützten Ressourcen. |
| T06 | Mit widerrufenem iPhone-Token die benutzerbezogenen Edge Functions aufrufen: Push-Test, Review-Push, Kontolöschung und Dokumentmigration. | Jede benutzerbezogene Funktion weist die alte Sitzung zurück; Konto und Dateien bleiben bestehen. |
| T07 | App auf dem iPhone schließen und mit der bereits gespeicherten Sitzung erneut öffnen, während das iPad aktiv ist. | Das iPhone widerruft beim Wiederherstellen nicht die iPad-Sitzung. |
| T08 | Auf dem iPhone erneut ausdrücklich anmelden. | iPhone wird aktiv; iPad wird anschließend als alte Sitzung erkannt. |
| T09 | Auf dem iPad normale lokale Abmeldung ausführen, während das iPhone aktiv ist. | Nur die lokale iPad-Sitzung wird beendet; iPhone bleibt aktiv. |
| T10 | Auf dem abgemeldeten Gerät lokale Planungsdaten prüfen und nach erneuter Anmeldung synchronisieren. | Lokale Daten sind nicht automatisch gelöscht; bestehende Konflikt-/Übernahmelogik schützt Änderungen. |
| T11 | OIDC-Ingestion mit gültigem erlaubtem GitHub-Workflow-Token sowie ungültigem/fremdem Token prüfen. | Erlaubter Workflow wird akzeptiert; falsches Repository, falscher Branch oder nicht erlaubter Workflow wird abgewiesen. |
| T12 | Rollback-Skript ausschließlich in der Testumgebung anwenden und alte App-/Function-Versionen verwenden. | Vorherige RLS-Regeln funktionieren; neue RPC-Aufrufe sind aus alten Clients entfernt bzw. nicht mehr erforderlich. |

## Abnahmekriterien

- T01–T12 dokumentiert; keine unerklärten Abweichungen.
- Alte, noch nicht abgelaufene JWTs können keine der geschützten Ressourcen nach Sitzungswiderruf lesen oder verändern.
- Eine wiederhergestellte Sitzung verdrängt niemals eine neuere Anmeldung.
- Lokale Daten bleiben bei Sitzungswiderruf erhalten.
- Die Edge Functions akzeptieren keine widerrufenen Benutzer-Sitzungen für privilegierte Aktionen.
- Rollback wurde separat erfolgreich geprüft.

## Noch nicht ausgeführt / bekannte Grenzen

- Es wurde kein gehostetes Supabase-Testprojekt und kein Supabase-Branch angelegt. Die lokale, temporäre Supabase-Instanz wird automatisiert in GitHub Actions gestartet und nach dem Test mit `supabase stop --no-backup` entfernt.
- `supabase/config.toml` enthält die minimale lokale CI-Konfiguration. Die vorhandene Produktions-Migrationskette wird in diesem Test absichtlich deaktiviert, weil sie von der noch nicht vollständig versionierten Produktions-Basisschemata abhängt.
- Der separate PostgreSQL-Test simuliert weiterhin gezielt RLS-Randfälle. Der zusätzliche lokale Supabase-E2E-Test deckt jetzt echte GoTrue-Sitzungen, JWT-Claims, PostgREST-RLS und Storage ab. Ein Test mit zwei realen iOS-Geräten und dem Safari-/PWA-Lebenszyklus steht noch aus.
- Die App erkennt den Widerruf auf dem alten Gerät beim nächsten Polling bzw. Token-Refresh, nicht zwingend sofort.
- Bereits ausgestellte signierte Storage-URLs können bis zum Ablauf ihrer Gültigkeit weiter funktionieren.
- Die Website-Inspector-DNS-Prüfung kann DNS-Rebinding zwischen Prüfung und HTTP-Verbindungsaufbau nicht vollständig ausschließen; diese Funktion benötigt vor einer Sicherheitsfreigabe eine zusätzliche Lösung, die DNS-Prüfung und tatsächliche Zielverbindung bindet.

## Freigaberegel

Keine Migration auf Produktion, kein Edge-Function-Deployment, kein Merge und keine Veröffentlichung ohne ausdrückliche Freigabe nach Sichtung der Testergebnisse.

## Automatisierter lokaler Supabase-E2E-Test (GitHub Actions)

Zusätzlich zum manuellen iPhone-/iPad-Test gibt es jetzt einen CI-Test mit einer echten lokalen Supabase-Instanz. Er startet GoTrue/Auth, PostgREST und Storage in Docker auf dem GitHub-Runner; es wird kein gehostetes Supabase-Projekt und kein Supabase-Branch angelegt.

Workflow: `.github/workflows/supabase-auth-session-e2e.yml`

Ablauf:
1. Lokalen Supabase-Stack mit festgelegter CLI-v2-Wartungsversion starten.
2. Die unvollständige Produktions-Migrationskette bewusst nicht automatisch ausführen (`db.migrations.enabled = false`); stattdessen nur ein minimales, wegwerfbares Testschema anlegen.
3. Genau die zu prüfende Session-Migration gegen die echte lokale Supabase-Auth-Datenbank anwenden.
4. Ein isoliertes Testkonto über die lokale Auth-Admin-API anlegen und zwei echte Passwort-Sitzungen erzeugen.
5. Den Logout-Scope `others` über den echten GoTrue-Endpunkt aufrufen.
6. Mit dem noch nicht abgelaufenen alten JWT prüfen, dass die Session-RPC `false` liefert, Planner-Daten und private Dateien nicht mehr lesbar sind und neue Schreibzugriffe blockiert werden.
7. Mit der aktuellen Sitzung prüfen, dass Zugriff und Refresh weiter funktionieren; mit dem widerrufenen Refresh-Token muss die Erneuerung scheitern.

Die lokalen Schlüssel werden ausschließlich zur Laufzeit vom lokalen CLI ausgegeben und als Job-Umgebungsvariablen verwendet. Es werden keine Produktions-Secrets benötigt. Die Testdaten und Container werden nach dem Lauf verworfen.

Ergebnis am 23.11.2026: Zwei vollständige lokale Supabase-E2E-Läufe waren erfolgreich: Auth/RLS/Storage `45185762018` und Auth/RLS/Storage plus Edge-Runtime `45186627686`. Der Test hat zwei echte GoTrue-Sitzungen erzeugt, den Logout-Scope `others` ausgeführt, den alten Refresh-Token abgewiesen, den neuen Refresh-Token akzeptiert und den Zugriff des alten JWT auf Planner-Daten, Push-Abos, Änderungsvorschläge und private Dateien gesperrt. Ein Schreibversuch mit dem alten JWT wurde ebenfalls abgewiesen. Zusätzlich wurde der Website-Inspector in der lokalen Edge-Runtime mit einem echten HTTPS-Abruf erfolgreich ausgeführt; eine IP-Literal-Adresse wurde abgelehnt.

Dieser Test ersetzt weiterhin keinen Test mit zwei realen iOS-Geräten. Die gehostete Produktions-Edge-Runtime wurde nicht verändert oder deployed.
