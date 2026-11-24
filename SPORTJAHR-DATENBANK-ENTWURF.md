# SPORTJAHR – Datenbank-Bestand und Erweiterungsentwurf

Stand: 24. November 2026

## 1. Verifizierter Ist-Zustand

Supabase-Projekt: `trail-event-planner` (PostgreSQL 17).

Öffentliche Tabellen:
- `planner_data`: eine Zeile; `user_id` (UUID, PK/FK auf auth.users), `data` (JSONB), `updated_at`.
- `event_change_proposals`: Vorschlags-/Freigabe-Workflow.
- `event_push_subscriptions`: Push-Abonnements.
- `event_push_rate_limits`: Push-Limits.

Es gibt derzeit keine normalisierten Tabellen für den Veranstaltungskatalog, persönliche Wettkampfteilnahmen oder Trainingsaktivitäten.

Der aktuelle persönliche JSONB-Datensatz enthält diese Top-Level-Schlüssel:
- `trailEventRunTypes`
- `trailEventDataEdits`
- `trailRacePriorities`
- `trailEventRunRecords`
- `trailPrivateBookings`
- `trailPrivateInvoices`
- `trailUserAddedEvents`
- `trailEventRunAttempts`
- `trailEventPlannerState`
- `trailRepeatPlanEntries`

Die Event-/Streckendatenbank wird im Frontend als `EVENTS`-Datenbestand geladen. Bestehende persönliche Planungen und Ergebnisse sind mit den vorhandenen Trail-Schlüsseln verknüpft.

## 2. Sicherheits- und API-Rahmen

`planner_data` hat Row Level Security aktiviert. Die vorhandenen Policies beschränken SELECT, INSERT, UPDATE und DELETE auf `auth.uid() = user_id`, jeweils für `authenticated`. Die Rolle `authenticated` hat die entsprechenden Tabellenrechte.

Wichtige Supabase-Plattformänderung: Seit 30. Oktober 2026 werden neue Tabellen im Schema `public` nicht mehr automatisch über die Data API exponiert. Neue Tabellen benötigen deshalb eine explizite Entscheidung zu Data-API-Exposition, Grants und RLS. Siehe Supabase Changelog: https://supabase.com/changelog/breaking-change-enabling-data-api-by-default

## 3. Architekturentscheidung für die Erweiterung

Der Eventkatalog und persönliche Aktivitäten sind unterschiedliche Dinge:

- Der Eventkatalog enthält öffentliche Veranstaltungen und Strecken. Er bleibt in dieser ersten Erweiterungsstufe unverändert.
- Persönliche Aktivitäten sind private Datensätze des Benutzers: Training, Wettkampfteilnahme und weitere Sporttermine.
- Eine persönliche Wettkampfteilnahme kann optional auf eine Veranstaltung und Strecke im Katalog verweisen.
- Wiederholte Teilnahmen an derselben Veranstaltung sind eigenständige persönliche Datensätze.

Die vorhandene `planner_data`-JSONB-Struktur bleibt für ihre bestehenden Schlüssel unangetastet. Neue Sportaktivitäten sollen nicht als unbekannter Schlüssel in den alten JSONB-Gesamtblob geschrieben werden, solange nicht geklärt ist, ob ältere App-Versionen den Blob vollständig überschreiben. Für neue Aktivitäten wird deshalb eine eigene Tabelle bevorzugt.

## 4. Entwurf der Tabelle `sport_activities`

Noch nicht angewendet – Schemaentwurf zur Prüfung.

| Feld | Typ | Zweck |
|---|---|---|
| id | uuid PK | stabile Aktivitäts-ID |
| user_id | uuid FK auth.users | Eigentümer |
| sport | text | `run`, `bike`, später erweiterbar |
| discipline | text nullable | `road`, `trail`, `ultra`, `backyard`, `mtb`, `road_cycling`, `gravel` |
| activity_type | text | `training`, `race`, `event` |
| title | text | Anzeigename |
| starts_at | timestamptz nullable | Beginn |
| ends_at | timestamptz nullable | Ende |
| distance_km | numeric nullable | Distanz |
| elevation_gain_m | integer nullable | Höhenmeter |
| duration_seconds | integer nullable | Dauer |
| status | text | `planned`, `completed`, `cancelled`, `dnf` |
| catalog_event_id | text nullable | optionale Referenz auf bestehende Event-ID |
| catalog_route_id | text nullable | optionale Referenz auf bestehende Strecken-ID |
| result | jsonb | sportartspezifisches Ergebnis |
| metadata | jsonb | zusätzliche sportartspezifische Angaben |
| created_at / updated_at | timestamptz | Zeitstempel |

### Regeln
- `sport`, `activity_type`, `title` und `status` sind Pflichtfelder.
- Distanz, Höhenmeter und Dauer bleiben nullable; unbekannt ist nicht gleich null.
- Lauf-/Trail-Felder wie UTMB Index, Cut-off und Backyard-Runden liegen in `result`/Metadaten und werden nur für passende Laufdisziplinen ausgewertet.
- Bike-Aktivitäten erhalten keine UTMB-Felder.
- `catalog_event_id` und `catalog_route_id` bleiben zunächst Textreferenzen, damit keine bestehende Event-ID-Struktur verändert werden muss.
- Wiederholte Teilnahmen werden durch getrennte Zeilen gespeichert.

## 5. RLS- und API-Anforderungen

Bei einer späteren Migration:
- RLS sofort aktivieren.
- SELECT: `auth.uid() = user_id`.
- INSERT: `WITH CHECK (auth.uid() = user_id)`.
- UPDATE: sowohl `USING` als auch `WITH CHECK` mit `auth.uid() = user_id`.
- DELETE: `auth.uid() = user_id`.
- Tabellenrechte für `authenticated` nur dann gewähren, wenn die Tabelle über die Data API genutzt werden soll.
- Keine `anon`-Freigabe.
- Keine `SECURITY DEFINER`-Funktion für normale CRUD-Vorgänge.
- Nach DDL die Supabase Security Advisors ausführen und Zugriffe mit zwei Benutzerkontexten testen.

## 6. Migrationsstrategie

1. Zuerst Schema und RLS in einem isolierten Entwicklungs-/Testkontext prüfen.
2. Neue Tabelle additiv anlegen; keine Änderung oder Löschung an `planner_data`.
3. Bestehende Trail-Daten nicht automatisch in die neue Tabelle kopieren. Erst nach eindeutigem Mapping und mit Duplikat-/Vollständigkeitsprüfung.
4. Neue Bike- und Trainingsaktivitäten zunächst nur in der neuen Tabelle speichern.
5. Bestehende Trail-Planung bleibt bis zur vollständigen Umstellung auf dem bisherigen Speicherweg.
6. Dual-Read/Write nur mit expliziter Versions- und Konfliktstrategie; keine stillen Blob-Überschreibungen.
7. Erst nach Tests wird die neue Aktivitätsliste in Sportjahr und Sport-Cockpit eingebunden.

## 7. Abnahmekriterien

- Ein bestehender Benutzer kann seine bisherigen Trail-Planungen unverändert öffnen.
- Neue Bike- und Trainingsaktivitäten lassen sich getrennt speichern und laden.
- Benutzer A kann keine Aktivitäten von Benutzer B lesen oder verändern.
- Wiederholte Wettkampfteilnahmen bleiben getrennt.
- Lauf- und Bike-Kennzahlen werden getrennt aggregiert.
- Fehlende sportartspezifische Werte bleiben NULL.
- Bestehende UTMB- und GPX-Funktionen bleiben unverändert.
