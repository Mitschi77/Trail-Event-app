# Persistente Speicherung für Gerätekonflikte

## Zweck

Die Migration `20261123090000_planner_conflict_sessions.sql` legt eine private Supabase-Tabelle für einen Konflikt zwischen zwei angemeldeten Geräten desselben Kontos an. Sie speichert beide vollständigen Datenstände getrennt, die gewählte Version und die Bestätigungszeitpunkte beider Geräte.

## Sicherheitsgrenzen

- Row Level Security ist aktiviert. Nur der angemeldete Eigentümer (`auth.uid() = user_id`) kann seine Konfliktsitzungen lesen, anlegen oder aktualisieren.
- Anonyme Zugriffe sind nicht freigegeben.
- Es wird kein `service_role`-Schlüssel in der App benötigt oder erlaubt.
- Die Gerätekennungen sind anwendungsseitige Kennungen, keine eigenständigen Authentifizierungsfaktoren. Zwei Bestätigungen sind daher eine bewusste Bedienbestätigung, aber kein Schutz gegen ein kompromittiertes Konto oder einen Client, der sich als anderes Gerät ausgibt.
- Die Tabelle speichert vollständige Planungsdaten und ist deshalb als personenbezogener, privater Datenspeicher zu behandeln.

## Verbindlicher Ablauf der App-Integration

1. Bei einem Konflikt automatische Cloud-Lese-/Schreibvorgänge, Wiederholungen und lokale Überschreibungen auf beiden Geräten anhalten.
2. Beide vollständigen lokalen Snapshots unverändert in `device_a_snapshot` und `device_b_snapshot` speichern. Ein fehlgeschlagener Upload darf die lokale Sicherung nicht löschen.
3. Beide Geräte lesen dieselbe Konfliktsitzung und zeigen Gerätebezeichnung, Erfassungszeitpunkt und Datenstand.
4. Eine Version auswählen und als `resolved_snapshot` speichern. Beide Original-Snapshots bleiben erhalten.
5. Jedes Gerät bestätigt separat. Erst wenn beide Zeitstempel gesetzt sind, darf der Client den Status auf `resolved` setzen.
6. Vor dem Schreiben in `planner_data` den exakten vorherigen `updated_at`-Wert vergleichen (Compare-and-swap). Wenn er nicht mehr übereinstimmt, nichts veröffentlichen und einen neuen Konflikt eröffnen.
7. Erst nach bestätigtem Cloud-Schreibvorgang darf der neue gemeinsame Baseline-Stand gesetzt und die normale Synchronisierung fortgesetzt werden.
8. Abgelaufene oder abgebrochene Konflikte dürfen nicht automatisch einen der beiden Datenstände verwerfen. Beide Snapshots müssen bis zu einer ausdrücklich bestätigten Bereinigung erhalten bleiben.

## Noch nicht durch diese Migration erledigt

Diese Migration erstellt nur das Datenbankschema und die Row-Level-Security-Regeln. Sie implementiert weder die App-Oberfläche noch Gerätekennung, IndexedDB-Backup, Polling, Statusübergänge, Compare-and-swap-Schreiblogik oder Wiederherstellung. Sie muss zuerst in einer Testumgebung angewendet und mit zwei realen Geräten geprüft werden. Eine produktive Migration oder Veröffentlichung erfolgt nicht automatisch.
