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

## 3. Architekturentscheidung: universelles Sportmodell

Das Sportjahr umfasst **gängige Sportarten**, nicht nur Ausdauer- und Outdoorsport. Beispiele sind Laufen, Bike, Schwimmen, Triathlon, Wandern, Teamsport (z. B. Fußball/Handball/Basketball), Racketsport (z. B. Tennis/Padel/Tischtennis), Kraft/Fitness, Winter-/Eissport, Wasser-, Berg-, Kampf- und weitere Sportarten. Die Liste ist ausdrücklich nicht abschließend.

Sportarten und Disziplinen dürfen nicht als feste PostgreSQL-Enums oder als geschlossene Frontend-Auswahlliste implementiert werden. Sie müssen über einen erweiterbaren Katalog bzw. konfigurierbare Datensätze verwaltet werden. Benutzerdefinierte Sportarten und Disziplinen müssen möglich sein.

### Fachliche Grundregeln
- Sportart, Disziplin/Variante und Aktivitätstyp sind getrennte Merkmale.
- Training, Wettkampf, Spiel und sonstiger Termin sind unterscheidbare Aktivitätstypen.
- Gemeinsame Felder bleiben optional, wenn sie nicht für jede Sportart sinnvoll sind.
- Sportartspezifische Ergebnisse dürfen nicht auf Distanz, Höhenmeter und Zeit reduziert werden.
- Mehrfachsegmente (Triathlon, Staffel, Mehrkampf) müssen geordnet und getrennt speicherbar sein.
- Team- und Einzelresultate müssen beide abbildbar sein.
- Eine einzelne Aktivität darf nicht durch Segmente versehentlich mehrfach in Summen gezählt werden.

**Backyard** ist ein eigenständiges rundenbasiertes Wettkampfformat. Die Rundenanzahl ist die führende Leistungskennzahl. Rundenlänge (6,7 km nur Standardwert), Rundenzeiten/Zeitstempel, Gesamtzeit, Gesamtdistanz und DNF/Ausscheiden müssen erhalten bleiben.

**Triathlon/Mehrkampf** benötigt Gesamtzeit und geordnete Segmente, z. B. Schwimmen, Radfahren, Laufen, plus getrennte Wechselzeiten T1/T2. Ein Radsegment eines Triathlons ist keine separate Bike-Aktivität.

Der Eventkatalog und persönliche Aktivitäten bleiben getrennt:
- Öffentliche Events und Strecken bleiben im bestehenden Katalog.
- Persönliche Aktivitäten sind private Datensätze für Training, Wettkampfteilnahme, Spiel und weitere Termine.
- Eine persönliche Teilnahme kann optional auf einen Katalogeintrag und eine Strecke verweisen.
- Wiederholte Teilnahmen sind eigenständige Datensätze.

Die bestehende `planner_data`-JSONB-Struktur bleibt für ihre vorhandenen Schlüssel unangetastet. Neue Aktivitäten werden nicht ohne Versions-/Konfliktstrategie in den alten Gesamtblob geschrieben.

## 4. Zielmodell – additive Tabellen

Noch nicht angewendet. Dies ist ein fachlicher Entwurf, keine produktive Migration.

### 4.1 `sports_catalog`
Erweiterbarer Katalog für Sportarten und Disziplinen:
- `id` UUID oder stabiler Textcode
- `parent_id` nullable für Hierarchie (Sportart → Disziplin → Variante)
- `code` Text, eindeutig
- `name` Text
- `category` Text nullable (z. B. Ausdauer, Team, Racket, Fitness, Winter, Wasser)
- `is_system` Boolean
- `is_active` Boolean
- `metadata` JSONB für optionale Anzeige-/Fachhinweise

Keine DB-Enums für Sportarten oder Disziplinen. Systemeinträge können global angeboten werden; persönliche Einträge müssen einem Benutzer zugeordnet oder anderweitig eindeutig abgegrenzt werden.

### 4.2 `sport_activities`
| Feld | Typ | Zweck |
|---|---|---|
| id | uuid PK | stabile Aktivitäts-ID |
| user_id | uuid FK auth.users | Eigentümer |
| sport_id | uuid/text FK | Sportart bzw. Disziplinbezug aus Katalog |
| activity_type | text | training, race, match, event o. ä.; erweiterbar |
| title | text | Anzeigename |
| starts_at / ends_at | timestamptz nullable | Beginn und Ende |
| location | text nullable | Ort |
| distance_km | numeric nullable | nur wenn sinnvoll |
| elevation_gain_m | integer nullable | nur wenn sinnvoll |
| duration_seconds | integer nullable | Dauer |
| status | text | planned, completed, cancelled, dnf o. ä. |
| catalog_event_id | text nullable | optionale Referenz auf bestehenden Event-Katalog |
| catalog_route_id | text nullable | optionale Referenz auf bestehende Strecken-ID |
| result | jsonb | sportartspezifisches Ergebnis |
| metadata | jsonb | weitere Angaben, Quelle, Notizen |
| created_at / updated_at | timestamptz | Zeitstempel |

Die finale FK-/Kataloghierarchie ist vor einer Migration anhand der tatsächlichen UI- und Abfrageanforderungen zu präzisieren. Die Tabelle darf keine geschlossene Sportartenliste erzwingen.

### 4.3 `sport_activity_segments`
Für Triathlon, Duathlon, Staffeln, Mehrkampf und andere zusammengesetzte Aktivitäten:
- `id` UUID PK
- `activity_id` FK auf `sport_activities`
- `sequence` Integer für die Reihenfolge
- `sport_id` nullable
- `segment_type` Text (z. B. swim, bike, run, transition)
- `name` Text nullable
- `distance` Numeric nullable plus Einheit
- `duration_seconds` Integer nullable
- `result` JSONB für weitere Segmentwerte

Segmente gehören zur Hauptaktivität und werden nicht als eigenständige Aktivitäten aggregiert.

### 4.4 Sportartspezifische Resultate
Kernfelder bleiben schlank. Ergebnisdetails liegen strukturiert in `result` bzw. bei Bedarf in Segment-/Runden-Unterdatensätzen:
- Backyard: Rundenanzahl, Rundenlänge, Rundenzeiten/Zeitstempel, DNF/Ausscheiden.
- Teamsport: Team, Gegner, Spielstand, Rolle/Einsatz.
- Racketsport: Gegner/Partner, Matchformat, Sätze und Spielstand.
- Kraft/Fitness: Übung, Sätze, Wiederholungen, Gewicht.
- Schwimmen: Bahnen, Stil, Distanz, Splits.
- Wintersport: Disziplin, Lauf-/Abfahrtszeit, Höhenmeter und Routenwerte.

Bei wiederkehrenden oder umfangreichen Messreihen (z. B. Backyard-Runden) ist eine eigene Kindtabelle einer unstrukturierten JSONB-Liste vorzuziehen, sofern Abfragen/Auswertungen darauf aufbauen sollen.

## 5. Regeln für bestehende Spezialmodule

- Lauf-/Trail-Felder wie UTMB Index, GPX, Cut-off und Pflichtausrüstung werden nur für passende Laufveranstaltungen angezeigt.
- Bike-Aktivitäten erhalten keine UTMB-Felder.
- Backyard-Rundenanzahl bleibt führend; Kilometer ersetzen sie nicht.
- Triathlon-Segmente werden nicht als separate Aktivitäten gezählt.
- Marathon, Halbmarathon und andere Laufarten behalten ihre bestehenden Fachregeln.
- `catalog_event_id` und `catalog_route_id` bleiben zunächst kompatible Textreferenzen; bestehende IDs werden nicht geändert.
- Wiederholte Teilnahmen werden als getrennte persönliche Datensätze gespeichert.

## 6. RLS- und API-Anforderungen

Bei einer späteren Migration:
- RLS sofort aktivieren.
- SELECT: `auth.uid() = user_id`.
- INSERT: `WITH CHECK (auth.uid() = user_id`.
- UPDATE: sowohl `USING` als auch `WITH CHECK` mit `auth.uid() = user_id`.
- DELETE: `auth.uid() = user_id`.
- Tabellenrechte für `authenticated` nur dann gewähren, wenn die Tabelle über die Data API genutzt werden soll.
- Keine `anon`-Freigabe für private Aktivitäten.
- Keine `SECURITY DEFINER`-Funktion für normale CRUD-Vorgänge.
- Katalog-Lesezugriff und persönliche Katalogeinträge getrennt absichern.
- Nach DDL Supabase Security Advisors ausführen und Zugriffe mit zwei Benutzerkontexten testen.

## 7. Migrationsstrategie

1. Schema und RLS zuerst isoliert testen.
2. Neue Tabellen additiv anlegen; `planner_data` nicht ändern oder löschen.
3. Bestehende Trail-Daten nicht automatisch kopieren. Mapping, Vollständigkeit und Duplikate zuerst prüfen.
4. Neue Aktivitäten schrittweise im neuen Modell speichern.
5. Bestehende Trail-Planung bleibt bis zur vollständigen Umstellung auf dem bisherigen Speicherweg.
6. Dual-Read/Write nur mit Versions- und Konfliktstrategie.
7. Erst nach Tests Aktivitätsliste, Sportjahr und Cockpit anbinden.

## 8. Abnahmekriterien

- Bestehende Trail-Planungen, Event-IDs, Strecken, UTMB-Daten und GPX-Referenzen bleiben unverändert nutzbar.
- Aktivitäten unterschiedlicher Sportarten können gespeichert und geladen werden, ohne neue Sportarten durch Schemaänderungen freischalten zu müssen.
- Benutzerdefinierte Sportarten/Disziplinen sind möglich.
- Backyard-Runden und Triathlonsegmente werden fachlich korrekt gespeichert.
- Team-, Racket-, Kraft-/Fitness- und weitere Resultattypen sind im Ergebnisfeld abbildbar.
- Segmente werden nicht doppelt als Aktivitäten gezählt.
- Benutzer A kann keine privaten Aktivitäten von Benutzer B lesen oder ändern.
- Wiederholte Teilnahmen bleiben getrennt.
- Nicht zutreffende Messwerte bleiben NULL.
- Keine produktive Migration erfolgt allein durch diesen Entwurf.
