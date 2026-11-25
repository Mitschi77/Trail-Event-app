# NORTHBOUND – Community MVP: Datenmodell und Rechtekonzept

**Stand:** 25.11.2026  
**Ziel:** Technische Spezifikation für die erste additive Community-Ausbaustufe.  
**Status:** Entwurf – keine SQL-Migration, keine Tabellenanlage und keine Änderung an Produktionsdaten.

## 1. Leitlinien

1. Bestehende Tabellen `planner_data`, `event_change_proposals` und die Strava-Tabellen bleiben unverändert.
2. Community-Inhalte werden nicht in `planner_data` als weiteres großes JSONB-Dokument gespeichert.
3. Jede Community-Ressource erhält stabile UUIDs, Eigentümerbezug, Zeitstempel und klare Status-/Sichtbarkeitsfelder.
4. Öffentliche Trails sind innerhalb der registrierten NORTHBOUND-Community sichtbar. Private Trails sind standardmäßig nur für ihren Eigentümer sichtbar. Eine spätere explizite Freigabe an einzelne Personen kann als eigener Schritt ergänzt werden.
5. Keine Community-Tabelle darf den offiziellen Wettkampf-/Eventkatalog verändern.
6. RLS und Storage-Regeln werden vor dem Frontend umgesetzt und mit getrennten Testkonten geprüft.

## 2. Phase 1 – Tabellenentwurf

Die folgenden Tabellen sind ein fachlicher Entwurf. Exakte SQL-Typen, Constraints, Indizes und Fremdschlüssel werden erst nach Prüfung der vorhandenen Auth-, Storage- und Namenskonventionen finalisiert.

### 2.1 `community_profiles`

Optionale Community-Präsentation eines Kontos; kein öffentliches Profil als Voraussetzung für die Mitgliedschaft.

Vorgesehene Felder:
- `user_id` (PK/FK auf `auth.users.id`)
- `display_name` (optional; Fallback bei fehlender öffentlicher Profilfreigabe: neutrale Autorenbezeichnung)
- `bio` (optional, begrenzt)
- `avatar_path` (optional, Storage-Pfad)
- `profile_visibility` (private/public, Standard private)
- `created_at`, `updated_at`

Rechte:
- Eigentümer kann eigenes Profil lesen und ändern.
- Andere Nutzer sehen nur ausdrücklich öffentliche Profilfelder.
- Ein öffentliches Profil ist nicht Voraussetzung, um Trails zu veröffentlichen, Challenges zu erstellen oder der Community beizutreten.

### 2.2 `community_trails`

Vorgesehene Felder:
- `id` (UUID, PK)
- `owner_id` (FK auf `auth.users.id`)
- `title`, `description`
- `visibility` (public/private; pro Trail auswählbar)
- `publication_status` (draft/published/archived)
- `distance_m`, `ascent_m`, `descent_m`
- `difficulty`, `surface_summary`, `region_name`, `country_code`
- `start_location_label` (optional, nicht automatisch exakte private Adresse)
- `created_at`, `updated_at`, `published_at`

Regeln:
- Nutzer verwalten nur eigene Trails.
- Öffentliche veröffentlichte Trails sind für angemeldete Community-Mitglieder lesbar.
- Private Trails sind nur für den Eigentümer lesbar; Freigaben an andere Personen benötigen später eine explizite ACL-Tabelle.
- Entwürfe sind nicht öffentlich auffindbar.
- Community-Trails werden niemals in den offiziellen Eventkatalog kopiert oder dort als Wettkämpfe behandelt.

### 2.3 `community_trail_assets`

Dateimetadaten zu Bildern, GPX-Dateien und optionalen Profilgrafiken:
- `id`, `trail_id`, `owner_id`
- `asset_kind` (image/gpx/elevation_profile)
- `storage_path`, `content_type`, `file_size`, `checksum`
- `download_enabled` (für GPX)
- `caption`, `alt_text`, `sort_order`
- `created_at`

Regeln:
- Storage-Bucket und Objektpfad werden nicht als öffentliches Universalverzeichnis betrieben.
- Öffentliche GPX-Downloads nur für veröffentlichte öffentliche Trails und nur, wenn der Eigentümer den Download aktiviert hat.
- Private Trail-Dateien bleiben privat.
- Uploads werden auf Dateityp, Größe und sichere Dateinamen geprüft; GPX wird als Nutzerdatenformat behandelt, nicht als vertrauenswürdiger Code.

### 2.4 `community_trail_favorites`

- `user_id`, `trail_id`, `created_at`
- Unique Constraint auf `(user_id, trail_id)`
- Nutzer können eigene Favoriten verwalten; Favoriten anderer Nutzer sind nicht automatisch öffentlich.

### 2.5 `community_trail_reviews`

- `id`, `trail_id`, `user_id`
- `rating` (Ganzzahl 1–5)
- `review_text` (optional)
- `created_at`, `updated_at`
- Unique Constraint auf `(trail_id, user_id)`

Regeln:
- Nur angemeldete Nutzer können bewerten.
- Eigene Bewertung kann geändert oder gelöscht werden.
- Aggregierte Sterne werden aus gültigen Bewertungen berechnet; keine vom Uploader selbst gesetzte Gesamtwertung.

### 2.6 `community_trail_comments`

- `id`, `trail_id`, `user_id`
- `parent_comment_id` (optional für Antworten)
- `body`, `created_at`, `updated_at`, `deleted_at`

Regeln:
- Kommentare nur für sichtbare öffentliche Trails.
- Verfasser kann eigene Kommentare bearbeiten/löschen.
- Melden/Moderieren wird getrennt protokolliert; private Nachrichten werden nicht als Kommentare behandelt.

### 2.7 `community_reports`

- `id`, `reporter_id`, `target_type`, `target_id`
- `reason_code`, `description`, `status`, `created_at`, `reviewed_at`, `reviewed_by`

Regeln:
- Meldungen sind nur für meldenden Nutzer und berechtigte Moderation sichtbar.
- Missbrauchsschutz und Rate-Limits.
- Eine Meldung ändert nicht automatisch Eigentum oder Inhalt.

## 3. Phase 2 – Social und Nachrichten

Zusätzliche Tabellen:
- `community_follows` (follower_id, followed_id, created_at; keine Selbst-Follows)
- `community_conversations` (Teilnehmer/Status/Zeitstempel)
- `community_conversation_members` (conversation_id, user_id)
- `community_messages` (conversation_id, sender_id, body, created_at, edited_at, deleted_at)
- `community_blocks` (blocker_id, blocked_id, created_at)
- `community_notification_preferences`
- `community_notifications`

Sicherheitsregeln:
- Nachrichten sind ausschließlich für Gesprächsteilnehmer lesbar.
- Moderatorrollen erhalten keine pauschale Leseberechtigung für private Nachrichten.
- Blockierte Konten können keine neuen Nachrichten an den blockierenden Nutzer senden.
- Nachrichtenanfragen und Missbrauchslimits verhindern unerwünschte Kontaktaufnahme.
- Benachrichtigungen unterstützen persönliche Aktivitäten sowie neue Trails in bevorzugten Regionen. Nutzer können Kategorien später einzeln steuern und Ruhezeiten einstellen.

## 4. Spätere Phasen

### Gruppen und Challenges
- Gruppen, Mitgliedschaften und Rollen (Gründer, Admin, Moderator, Mitglied).
- Jeder registrierte Nutzer darf eine Challenge erstellen.
- Challenge-Teilnahme und Ergebnisnachweise sind getrennte Datensätze.
- Strava-Aktivitäten werden nur einzeln und freiwillig aus `strava_activities` verknüpft. Keine automatische Vollübernahme und keine Duplikate.

### Gemeinsame Reisen
- Reisen, Etappen, Teilnehmer, Aufgaben und Änderungsprotokoll.
- Bestätigte Teilnehmer dürfen gemeinsam planen und Änderungen vorschlagen.
- Rollen und Konflikterkennung schützen parallele Änderungen.

### Trail-Wiki
- Einträge, Quellen, Autoren und Aktualitätsstatus.
- Jeder registrierte Nutzer kann neue Informationen ergänzen.
- Änderungen an bestehenden Einträgen werden als Vorschlag gespeichert.
- Bestätigung durch ursprünglichen Verfasser oder Moderator.
- Sicherheitsrelevante Meldungen können sofort als Warnhinweis erscheinen, bleiben bis zur Bestätigung als Meldung gekennzeichnet.

### Trail Academy
- Redaktionelle Fachinhalte und Community-Beiträge.
- Herkunft/Qualitätsstatus wird klar gekennzeichnet.
- Fachinhalte haben Quellen, Prüfdatum und verantwortliche Redaktion/Expertenrolle.

### Trail Intelligence
- Zweckgebundene Einwilligungen je Datenkategorie.
- Widerruf und nachvollziehbarer Verwendungszweck.
- Persönliche Analysen standardmäßig privat.

### Marktplatz
- Anbieter und Angebote mit externen Buchungs-URLs.
- Buchung/Zahlung bleiben in der ersten Version extern.
- Werbliche oder provisionsbasierte Angebote werden klar gekennzeichnet.

## 5. RLS-Rechtematrix für den Community-MVP

| Ressource | Eigentümer | Andere angemeldete Nutzer | Moderation |
|---|---|---|---|
| Privates Profil | Lesen/ändern | Keine privaten Felder | Kein pauschaler Zugriff |
| Öffentliches Profil | Lesen/ändern | Freigegebene Felder lesen | Nur bei gemeldeten Inhalten |
| Öffentlicher Trail | Vollzugriff | Lesen | Moderationsaktionen protokolliert |
| Privater Trail | Vollzugriff | Kein Zugriff | Kein pauschaler Zugriff |
| Öffentliche GPX-Datei | Verwalten | Download gemäß Freigabe | Nur gemeldete Inhalte |
| Private GPX-Datei | Verwalten | Kein Zugriff | Kein pauschaler Zugriff |
| Eigene Favoriten | Lesen/ändern | Nicht sichtbar | Nicht sichtbar |
| Bewertung/Kommentar | Eigene verwalten | Öffentliche Inhalte lesen | Moderation nach Meldung |
| Private Nachricht | Eigene Nachrichten | Nur Gesprächsteilnehmer | Kein pauschaler Lesezugriff |
| Meldung | Eigene Meldung lesen | Kein Zugriff | Bearbeitung nach Rolle |

## 6. Testfälle vor dem ersten Release

Mindestens zwei getrennte Testkonten (A und B) plus nicht angemeldeter Zugriff:

1. A legt einen privaten Trail an: B und nicht angemeldete Besucher dürfen weder Metadaten noch GPX/Bilder abrufen.
2. A veröffentlicht einen öffentlichen Trail: B kann ihn sehen, bewerten, kommentieren und – bei aktivierter GPX-Freigabe – die GPX-Datei laden.
3. B kann den Trail von A nicht bearbeiten oder löschen.
4. A kann die Bewertung von B nicht ändern.
5. Private Favoriten von A sind für B nicht sichtbar.
6. Uploads mit unzulässigem Dateityp oder überschrittener Dateigröße werden abgewiesen.
7. Ein privater Storage-Pfad kann nicht durch Erraten einer URL öffentlich gelesen werden.
8. Community-Daten erzeugen keine Einträge im offiziellen Eventkatalog.
9. Nutzer ohne öffentliches Profil können der Community beitreten und die freigegebenen Community-Funktionen nutzen.
10. RLS- und Storage-Tests werden automatisiert in CI eingebunden.

## 7. Offene technische Prüfungen vor SQL

- Bestehende Auth-Initialisierung und Profil-/Kontodarstellung im Frontend erfassen.
- Vorhandene Storage-Buckets, Policies und Upload-Konventionen prüfen.
- Bestehende Edge Functions und Service-Role-Zugriffe dokumentieren.
- Karten-/GPX-Darstellung und maximale Dateigrößen festlegen.
- Moderationsrollen und Eigentümerprüfung ohne fest codierte Benutzer-IDs entwerfen.
- Tabellen-, Enum- und Policy-Namen gegen alle vorhandenen Migrationen prüfen.

**Freigabegrenze:** Dieses Dokument ist eine Spezifikation. Es erstellt keine Tabellen und führt keine Migration aus. Die erste Community-Migration wird separat als additive, reviewbare SQL-Migration vorbereitet und erst nach Prüfung auf einer Entwicklungsumgebung angewendet.
