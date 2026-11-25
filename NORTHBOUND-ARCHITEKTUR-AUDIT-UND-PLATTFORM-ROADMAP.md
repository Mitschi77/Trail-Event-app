# NORTHBOUND – Architektur-Audit und Ausbauplan

**Prüfstand:** 25.11.2026  
**Basis:** Repository `Mitschi77/Trail-Event-app`, Branch `main`, Commit `2b6e44c1f8da3682fe123c517eb21085f4b67650`  
**Supabase-Projekt:** `trail-event-planner` (`oycfmdovrnvhcwxmpanl`), Region `eu-west-1`, Status beim Audit: `ACTIVE_HEALTHY`

> Dieses Dokument ist eine Bestandsaufnahme und ein Architekturvorschlag. Die bestehende Produktiv-App wird als unmittelbare UI- und Abnahmeumgebung genutzt. Datenbankmigrationen und sicherheitskritische Änderungen werden davon getrennt kontrolliert vorbereitet und erst nach ausdrücklicher Freigabe ausgeführt.

## 1. Kurzfassung

NORTHBOUND soll als bestehende Anwendung modular erweitert werden. Es wird keine zweite App und keine parallele Datenbasis aufgebaut. Die vorhandene Wettkampfverwaltung, Laufhistorie, Strava-Aktivitäten und persönliche Planungsdaten bleiben erhalten.

Die neue Trail-Plattform wird schrittweise ergänzt. Jede Phase erhält eigene Migrationen, RLS-Policies, Storage-Regeln, Tests und einen überprüfbaren Release-Schritt.

## 2. Bestand am 25.11.2026

### 2.1 GitHub

- Standardbranch: `main`
- Audit-Basiscommit: `2b6e44c1f8da3682fe123c517eb21085f4b67650`
- Letzter Commit trennt Strava-Training und die Zuordnung von Strava-Aktivitäten zu bereits gelaufenen Wettkämpfen.
- Es bestehen zahlreiche offene Pull Requests. Mehrere UI-Branches sind gegenüber dem aktuellen `main` deutlich zurückgefallen und dürfen nicht ungeprüft zusammengeführt werden.
- Beispiele aus dem Audit:
  - PR #349 (Cockpit-Render-Fix): Branch 1 Commit voraus und 22 Commits hinter `main`; Vergleichsstatus `diverged`.
  - PR #334 (Menü-/Designvereinheitlichung): 5 Commits voraus und 34 Commits hinter `main`; Vergleichsstatus `diverged`.
  - PR #364 (Integrationsarchitektur): 2 Commits voraus und 14 Commits hinter `main`; enthält einen Architekturentwurf.
- Vor jedem Merge: Branch aktualisieren, Konflikte auflösen, vollständige CI und gezielte Regressionstests ausführen.

### 2.2 Supabase

- Projektstatus: `ACTIVE_HEALTHY`
- PostgreSQL 17
- 25 registrierte Migrationen bis einschließlich der Strava-Race-Link-Härtung vom 25.11.2026.
- Im Schema `public` wurden acht Tabellen gefunden:
  - `planner_data`
  - `event_change_proposals`
  - `event_push_subscriptions`
  - `event_push_rate_limits`
  - `strava_oauth_states`
  - `strava_connections`
  - `strava_activities`
  - `strava_race_activity_links`
- `planner_data` speichert persönliche Planungsdaten derzeit als JSONB pro Nutzer. Diese Struktur darf nicht durch eine unkoordinierte Migration ersetzt werden.
- Strava-Aktivitäten und die optionale Zuordnung zu Wettkampfteilnahmen sind bereits als eigene Datenbereiche angelegt.
- Es wurden noch keine Community-, Gruppen-, Nachrichten-, Reise-, Wiki-, Academy- oder Marktplatz-Tabellen gefunden.

### 2.3 RLS- und Sicherheitsbefund

Alle acht geprüften öffentlichen Tabellen haben Row Level Security aktiviert.

Vorhandene nutzerbezogene Policies bestehen unter anderem für `planner_data`, `strava_activities`, `strava_race_activity_links`, Push-Abonnements und die Event-Änderungswarteschlange.

Der Supabase-Sicherheitsberater meldet RLS-aktivierte Tabellen ohne Policies:
- `event_push_rate_limits`
- `strava_connections`
- `strava_oauth_states`

Das kann für ausschließlich serverseitig verwendete Tabellen beabsichtigt sein. Vor Änderungen muss anhand der Edge Functions und tatsächlichen Zugriffswege bestätigt werden, dass Browser-/Clientzugriffe nicht benötigt werden und Service-Role-Zugriffe korrekt begrenzt sind. Keine pauschalen Policies ergänzen, die Token- oder Rate-Limit-Daten für angemeldete Nutzer öffnen.

Weitere Befunde:
- Supabase Auth: Schutz vor kompromittierten Passwörtern ist derzeit deaktiviert. Aktivierung in den Auth-Sicherheitseinstellungen prüfen und anschließend Login/Signup testen.
- Performance-Berater: Fremdschlüsselindex für `strava_oauth_states.user_id` fehlt.
- Drei Indizes werden derzeit als ungenutzt gemeldet. Nicht automatisch löschen; zunächst Nutzung, Abfragepfade und jüngste Migrationen prüfen.

## 3. Verbindliche Produktentscheidungen

### 3.1 Trail Community

- Teilnahme für alle registrierten Nutzer; kein öffentliches Profil als Voraussetzung.
- Nutzer können eigene Trails veröffentlichen.
- Jeder Trail erhält eine eigene Sichtbarkeit: öffentlich oder privat.
- Öffentliche Trails dürfen GPX zum Download anbieten.
- Bewertungen mit Sternen und Kommentare.
- Private Nachrichten zwischen Nutzern.
- Benachrichtigungen auch für neue Trails in bevorzugten Regionen; zusätzlich persönliche Community-Aktivitäten.
- Nutzer können anderen folgen, Trails favorisieren und Sammlungen anlegen.
- Jeder darf Challenges erstellen.
- Strava ist freiwillig; einzelne Aktivitäten werden manuell/gezielt einer Challenge oder einem Community-Trail zugeordnet. Keine verpflichtende Kontofreigabe und keine automatische Übernahme aller Aktivitäten.
- Laufpartner, gemeinsame Läufe, Gruppen und Gruppenkalender sind vorgesehen.
- Trail-Reisen werden gemeinsam bearbeitet: bestätigte Teilnehmer dürfen mitplanen und Änderungen vorschlagen.

### 3.2 Trail-Wiki

- Alle registrierten Nutzer dürfen neue Informationen ergänzen.
- Änderungen an bestehenden Einträgen werden als Vorschläge gespeichert.
- Bestätigung durch ursprünglichen Verfasser oder Moderator erforderlich.
- Sicherheitsrelevante Meldungen dürfen zusätzlich sofort als Warnhinweis gekennzeichnet werden; die Meldung ist nicht automatisch eine bestätigte Tatsache.
- Einträge benötigen Autor, Zeitstempel, Bestätigungsstatus und nachvollziehbare Änderungshistorie.

### 3.3 Trail Academy

- Gemischtes Modell: redaktionelle/fachlich geprüfte Inhalte plus Community-Beiträge.
- Fachinformationen und persönliche Erfahrungen müssen klar unterscheidbar sein.
- Sicherheits- und gesundheitsrelevante Inhalte benötigen nachvollziehbare Quellen und fachliche Prüfung.

### 3.4 Trail Intelligence

- Nutzer entscheiden individuell, welche Datenkategorien für Analysen und Empfehlungen genutzt werden dürfen.
- Keine öffentliche Weitergabe persönlicher Trainingsdaten ohne ausdrückliche Freigabe.
- Freigaben müssen zweckgebunden, widerrufbar und nachvollziehbar sein.

### 3.5 Marktplatz

- Anbieterprofile und Angebotsdarstellung in NORTHBOUND.
- Buchung und Zahlung erfolgen in der ersten Version extern beim Anbieter.
- Externe Buchungslinks werden gespeichert; keine integrierte Zahlungsabwicklung in Phase 1.
- Bezahlte Platzierungen und Affiliate-Angebote müssen klar gekennzeichnet sein.

## 4. Zielarchitektur

NORTHBOUND bleibt eine gemeinsame App mit modularen Fachbereichen und einer gemeinsamen Authentifizierung.

### Bestehende Bereiche erhalten

- Wettkampf-/Eventkatalog und offizielle Streckendaten
- Event Planner und Jahresübersicht
- Laufhistorie
- Strava-Aktivitäten und Race-Link-Zuordnung
- Persönliche Planungsdaten und bestehende Cloud-Synchronisierung
- Event-Änderungsvorschläge und Freigabeprozess

### Neue Datenbereiche schrittweise ergänzen

1. **Community Core:** Profileinstellungen für Community, Trails, Bilder/Dateien, Favoriten, Bewertungen und Kommentare.
2. **Social:** Folgen, private Nachrichten, Blockieren, Melden und Benachrichtigungen.
3. **Groups & Challenges:** Gruppenrollen, Mitgliedschaften, Challenge-Regeln, Teilnehmer und Ergebnisnachweise.
4. **Travel:** Reisen, Etappen, Teilnehmer, gemeinsame Bearbeitungsrechte, Aufgaben und Änderungsprotokoll.
5. **Knowledge:** Wiki-Einträge, Änderungsvorschläge, Bestätigungen und Quellen; Academy-Inhalte, Lektionen und Lernfortschritt.
6. **Intelligence:** Datenfreigaben, Analyseaufträge und private Empfehlungen.
7. **Marketplace:** Anbieter, Angebote, Kategorien, Aktualisierungszeitpunkt und externe URLs.

## 5. Vorschlag für die erste Community-Datenstruktur

Die endgültigen Tabellennamen und Spalten werden erst nach Prüfung des aktuellen Frontends, der Authentifizierung und der vorhandenen Storage-Buckets festgelegt. Folgende Entitäten sind fachlich erforderlich:

- Community-Profil (1:1 zu `auth.users`)
- Trail (Owner, Sichtbarkeit, Titel, Beschreibung, Distanz, Höhenmeter, Schwierigkeit, Status)
- Trail-Dateien/Medien (Bilder, GPX, Höhenprofil, Dateimetadaten und Rechte)
- Trail-Favoriten
- Trail-Bewertungen und Kommentare
- Nutzer-Follows
- Nachrichtenkonversationen und Nachrichten
- Nutzerblockierungen und Inhaltsmeldungen
- Benachrichtigungspräferenzen und Benachrichtigungen

Wichtige Integritätsregeln:
- Private Trails dürfen weder über Listen, Suche, Karten-APIs noch Storage-URLs unberechtigt offengelegt werden.
- GPX-Dateien privater Trails sind nur für den Eigentümer und explizit berechtigte Personen zugänglich.
- Öffentliche GPX-Downloads werden nur für öffentliche Trails und nur bei entsprechender Freigabe angeboten.
- Private Nachrichten sind nur für die beteiligten Konten zugänglich; Moderation erhält keine pauschale Leseberechtigung.
- Community-Trails sind strikt getrennt vom offiziellen Eventkatalog.
- Nutzer können nur eigene Inhalte bearbeiten/löschen; Moderationsrechte sind separat und protokolliert.

## 6. Migrations- und Release-Reihenfolge

### Phase 0 – Bestand und Sicherheit

- Aktuelle Policies, Funktionen, Trigger, Storage-Buckets und Secrets-Zugriffswege vollständig dokumentieren.
- Auth-Schutz gegen kompromittierte Passwörter aktivieren, nach Freigabe/Prüfung.
- Server-only-Tabellen ohne Policies überprüfen.
- Fehlenden Index für `strava_oauth_states.user_id` prüfen und bei bestätigtem Bedarf ergänzen.
- Veraltete Audit-/Roadmap-Dokumentation aktualisieren.
- Keine Eventdaten oder persönlichen JSONB-Daten migrieren.

### Phase 1 – Community MVP

- Community-Profil mit optionaler Sichtbarkeit.
- Trails öffentlich/privat anlegen und verwalten.
- Bilder und GPX-Dateien mit getrennten Storage-Regeln.
- Suche/Karte nur mit sichtbaren Trails.
- Favoriten, Sternebewertungen und Kommentare.
- RLS-Tests für Eigentümer, fremde Nutzer, anonyme Zugriffe und private Dateien.

### Phase 2 – Social

- Folgen, private Nachrichten, Nachrichtenanfragen.
- Blockieren, Melden und Moderationsworkflow.
- Benachrichtigungen und regionale Trail-Abos.
- Push-Kategorien und Ruhezeiten.

### Phase 3 – Gruppen und Challenges

- Gruppen, Rollen und Mitgliedschaften.
- Eigene Challenges und Teilnahme.
- Freiwillige, einzelne Aktivitätszuordnung aus `strava_activities`.
- Deduplizierung und Challenge-spezifische Ergebnisregeln.

### Phase 4 – Gemeinsame Reisen

- Reise, Etappen, Teilnehmer und Rollen.
- Gemeinsame Bearbeitung durch bestätigte Teilnehmer.
- Vorschläge/Änderungsprotokoll und Konflikterkennung.
- Unterkunfts- und Kosteninformationen mit externen Buchungslinks.

### Phase 5 – Wiki und Academy

- Wiki-Einträge und Änderungsvorschläge mit Bestätigung.
- Quellen, Aktualitätsstatus und Warnmeldungen.
- Redaktionelle und Community-Inhalte getrennt kennzeichnen.
- Lernpfade und privater Lernfortschritt.

### Phase 6 – Intelligence

- Zweckgebundene Datenfreigaben je Datenkategorie.
- Widerruf, Datenexport und Löschpfad.
- Private Analysen und Empfehlungen; keine automatische öffentliche Veröffentlichung.

### Phase 7 – Marktplatz und Gesamtintegration

- Anbieterprofile und Angebote.
- Externe Buchungslinks.
- Cockpit-Karten, globale Suche und gemeinsamer Kalender.
- Premium-/Free-Funktionsgrenzen und transparente Partnerkennzeichnung.

## 7. Qualitäts- und Sicherheits-Gates je Release

Jede Migration und jeder Release muss mindestens folgende Prüfungen bestehen:

- UI- und Funktionsabnahme erfolgt direkt in der bestehenden NORTHBOUND-Produktiv-App. Datenbankmigrationen werden vorab technisch geprüft, reproduzierbar dokumentiert und nur nach ausdrücklicher Freigabe kontrolliert auf Produktion angewendet.
- RLS-Tests decken Eigentümer, andere angemeldete Nutzer und nicht angemeldete Zugriffe ab.
- Storage-Policies verhindern private Datei-Leaks.
- Bestehende Event-, Planner- und Laufhistorien-Funktionen bleiben regressionsfrei.
- Strava-Aktivitäten werden nicht dupliziert oder ohne Zustimmung weiterverwendet.
- Keine Secrets oder Tokens im Frontend, Repository oder Logs.
- iPhone, iPad und Web werden geprüft.
- Synchronisationskonflikte und Offline-Zustände werden getestet.
- Rollback-/Wiederherstellungsweg ist dokumentiert.
- Änderungen an der laufenden App dürfen direkt in der Produktiv-App ausprobiert werden; Datenbankmigrationen, Datenumbauten, Storage-Änderungen und sicherheitskritische Eingriffe benötigen weiterhin Review, dokumentierten Rückweg und ausdrückliche Freigabe.

## 8. Nächste konkrete Arbeitsschritte

1. Bestehende Auth-, Edge-Function- und Storage-Implementierung vollständig erfassen.
2. Den aktuellen UI-/Menüstand und die offenen UI-PRs auf Basis des aktuellen `main` konsolidieren; keine alten divergierten Branches ungeprüft mergen.
3. Eine Community-MVP-Spezifikation mit exakten Tabellen, Beziehungen, RLS-Policies und Storage-Regeln erstellen.
4. Die UI in der bestehenden Produktiv-App schrittweise integrieren und dort mit dem tatsächlichen Nutzungskontext abnehmen.
5. Additive Datenbankmigrationen separat reviewen, Auswirkungen und Rückweg dokumentieren und erst nach ausdrücklicher Freigabe kontrolliert anwenden.

**Status:** Dokumentations- und Architekturvorschlag. Die Produktiv-App ist die vorgesehene UI-Test- und Abnahmeumgebung. Community-Datenbankmigrationen sind vorbereitet, aber noch nicht in Produktion ausgeführt; bestehende Nutzerdaten bleiben unangetastet.
