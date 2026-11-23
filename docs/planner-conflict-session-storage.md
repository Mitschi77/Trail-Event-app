# Persistente Speicherung für Gerätekonflikte

## Zweck

Die Migration `20261123090000_planner_conflict_sessions.sql` legt eine private Supabase-Tabelle für einen Konflikt zwischen zwei angemeldeten Geräten desselben Kontos an. Sie speichert zunächst den vollständigen Stand des auslösenden Geräts; das zweite Gerät ergänzt beim Beitritt seinen eigenen vollständigen Stand. Beide Original-Snapshots bleiben getrennt erhalten.

Die Migration enthält außerdem eine RPC-Funktion, die den ausgewählten und von beiden Geräten bestätigten Stand atomar in `planner_data` veröffentlicht – aber nur, wenn der Cloud-Datensatz seit Konfliktbeginn unverändert geblieben ist.

## Sicherheitsgrenzen

- Row Level Security ist aktiviert. Nur der angemeldete Eigentümer (`auth.uid() = user_id`) kann seine Konfliktsitzungen lesen, anlegen oder aktualisieren.
- Anonyme Zugriffe sind nicht freigegeben.
- Die Veröffentlichungsfunktion prüft die angemeldete Eigentümer-ID, sperrt die Konfliktsitzung und vergleicht den gespeicherten `base_cloud_updated_at`-Wert mit dem aktuellen `planner_data.updated_at`. Bei einer zwischenzeitlichen Änderung wird die gesamte Transaktion zurückgerollt.
- Es wird kein `service_role`-Schlüssel in der App benötigt oder erlaubt.
- Die Gerätekennungen sind anwendungsseitige Kennungen, keine eigenständigen Authentifizierungsfaktoren. Zwei Bestätigungen sind daher bewusste Bedienbestätigungen, aber kein Schutz gegen ein kompromittiertes Konto oder einen Client, der sich als anderes Gerät ausgibt.
- Die Tabelle speichert vollständige Planungsdaten und ist deshalb als personenbezogener, privater Datenspeicher zu behandeln.

## Verbindlicher Ablauf der App-Integration

1. Bei einem Konflikt automatische Cloud-Lese-/Schreibvorgänge, Wiederholungen und lokale Überschreibungen auf beiden Geräten anhalten.
2. Den vollständigen lokalen Snapshot zuerst dauerhaft in IndexedDB sichern. Erst danach darf Gerät A eine Konfliktsitzung mit `device_a_snapshot` und dem exakten aktuellen `planner_data.updated_at` als `base_cloud_updated_at` anlegen.
3. Gerät B liest die offene Sitzung, sichert seinen vollständigen Snapshot lokal und tritt nur dann bei, wenn `device_b_id` noch leer ist. Der Beitritt muss bedingt auf `device_b_id IS NULL` erfolgen.
4. Beide Geräte lesen dieselbe Sitzung und zeigen Gerätebezeichnung, Erfassungszeitpunkt und beide Datenstände. Ein Konflikt mit nur einem beigetretenen Gerät bleibt offen; es darf nichts veröffentlicht werden.
5. Eine Version auswählen und als `resolved_snapshot` speichern. Beide Original-Snapshots bleiben erhalten.
6. Jedes Gerät bestätigt separat. Erst wenn beide Bestätigungszeitstempel gesetzt sind, darf der Status auf `resolved` wechseln.
7. Ein Gerät ruft `publish_planner_conflict_session(session_id)` auf. Die Datenbank veröffentlicht atomar und nur bei passendem `base_cloud_updated_at`; bei einem zwischenzeitlich geänderten Cloud-Stand wird nichts überschrieben.
8. Erst nach erfolgreicher RPC-Antwort dürfen beide Geräte den veröffentlichten Snapshot lokal übernehmen, ihre Cloud-Baseline aktualisieren und die normale Synchronisierung fortsetzen.
9. Abgelaufene oder abgebrochene Konflikte dürfen nicht automatisch einen der beiden Datenstände verwerfen. Beide Snapshots müssen bis zu einer ausdrücklich bestätigten Bereinigung erhalten bleiben.

## Noch nicht durch diese Migration erledigt

Diese Migration erstellt nur das Datenbankschema und die Row-Level-Security-Regeln sowie die atomare Veröffentlichungsfunktion. Sie implementiert weder die App-Oberfläche noch Gerätekennung, IndexedDB-Backup, Beitritt, Polling, Auswahl, Bestätigung oder lokale Wiederherstellung. Sie muss zuerst in einer Testumgebung angewendet und mit zwei realen Geräten geprüft werden. Eine produktive Migration oder Veröffentlichung erfolgt nicht automatisch.
