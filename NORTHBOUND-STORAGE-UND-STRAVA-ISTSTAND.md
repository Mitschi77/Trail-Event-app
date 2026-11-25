# NORTHBOUND – Storage- und Integrations-Iststand

**Prüfdatum:** 25.11.2026  
**Supabase-Projekt:** `trail-event-planner`  
**Branchbasis:** `main` bei Commit `2b6e44c1f8da3682fe123c517eb21085f4b67650`

Dieses Dokument ergänzt das Architektur-Audit. Es ist eine reine Bestandsaufnahme und ändert keine produktiven Einstellungen.

## 1. Supabase Storage – Iststand

In `storage.buckets` wurde aktuell genau ein Bucket gefunden:

| Bucket | Öffentlich | Begrenzung | Verwendung |
|---|---:|---:|---|
| `trail-private-documents` | Nein | derzeit keine konfigurierte Größen-/MIME-Begrenzung | Private Nutzerdokumente |

Vorhandene Policies auf `storage.objects` erlauben authentifizierten Nutzern Insert, Select, Update und Delete nur dann, wenn:
- `bucket_id = 'trail-private-documents'`
- der erste Ordner im Objektpfad der eigenen `auth.uid()` entspricht.

Damit ist das bestehende Muster nutzerbezogener privater Dateien erkennbar. Es ist aber noch keine Community-Dateifreigabe.

### Konsequenz für Community-Trails

Den bestehenden privaten Bucket nicht in einen öffentlichen Bucket umwandeln und nicht für Community-Uploads öffnen.

Empfohlenes späteres Modell:
- Eigener privater Community-Bucket für alle Community-Dateien.
- Zugriff über Storage-RLS und eine serverseitig geprüfte Trail-Sichtbarkeit.
- Öffentliche GPX-Dateien nur über einen kontrollierten Downloadpfad, der prüft, ob der zugehörige Trail veröffentlicht und öffentlich ist und ob der Eigentümer GPX-Download erlaubt.
- Private Trail-Bilder und GPX-Dateien bleiben privat.
- Keine öffentliche Speicherung allein deshalb, weil ein Trail einen öffentlichen Titel oder Karten-Pin besitzt.
- Upload-Beschränkungen für MIME-Typ, Dateigröße und Dateiendung.
- Für GPX zusätzliche Plausibilitätsprüfung der XML-Struktur und Koordinaten; Dateiinhalt niemals als ausführbaren Inhalt behandeln.

Eine einfache Bucket-Policy nach Benutzerordner reicht für öffentliche und private Trail-Rechte nicht aus. Die Objektberechtigung muss an den zugehörigen Trail-Datensatz gekoppelt werden. Die endgültige Umsetzung kann deshalb über eine kontrollierte Edge Function oder eng begrenzte SQL-Hilfsfunktion erfolgen. Keine weit gefasste Storage-Policy mit beliebigem Clientzugriff.

## 2. Strava – tatsächlicher Backend-Stand

Die folgenden Supabase Edge Functions sind aktuell als ACTIVE gelistet:

| Funktion | JWT-Prüfung | Aufgabe |
|---|---:|---|
| `strava-connect` | Ja | OAuth starten, Status abfragen, Verbindung trennen |
| `strava-callback` | Nein | Öffentlicher OAuth-Callback von Strava |
| `strava-sync` | Ja | Aktivitäten synchronisieren, Tokens bei Bedarf erneuern |
| `strava-activity-detail` | Ja | Details und Streams einer eigenen Aktivität laden |

Wichtige Beobachtungen aus dem Quellcode:
- `strava-connect` verlangt einen authentifizierten Nutzer.
- OAuth-State wird gehasht gespeichert und läuft nach zehn Minuten ab.
- Angeforderte Scopes: `read,activity:read_all`.
- `strava-callback` konsumiert den State einmalig und prüft Ablaufzeit und Aktivitäts-Leseberechtigung.
- Access- und Refresh-Tokens werden serverseitig verschlüsselt gespeichert.
- `strava-sync` verlangt Authentifizierung, aktualisiert ablaufende Tokens und liest Aktivitäten vom Strava-API-Endpunkt.
- `strava-activity-detail` prüft, dass die angefragte Aktivität zum angemeldeten Nutzer gehört.
- Beim Trennen der Verbindung wird der Provider-Widerruf angestoßen; importierte Aktivitäten können erhalten bleiben.

### Konsequenz

Strava ist kein zukünftiges Architekturmodul mehr, sondern bereits ein bestehender Integrationsbereich. Er wird in Community-Challenges später nur über eine zusätzliche, freiwillige Zuordnung einzelner vorhandener Aktivitäten erweitert.

Keine zweite OAuth-Implementierung und keine neue Token-Tabelle für Community-Challenges erstellen.

### Noch zu verifizieren

- Frontend-Callback und tatsächlicher Rücksprung in die App auf iPhone/iPad.
- Verhalten bei abgelehnter Freigabe, abgelaufenem State und widerrufenem Strava-Token.
- Duplikaterkennung und erneuter Backfill bei bereits importierten Aktivitäten.
- Scope-Anzeige und vollständige Trennung/Löschung.
- Sichtbarkeit von Detailstreams und GPS-Daten ausschließlich für den Eigentümer.
- Rate-Limit- und Fehlerbehandlung bei größeren Backfills.

## 3. Vor der ersten Community-Migration

1. Bestehenden privaten Bucket unverändert lassen.
2. Community-Dateibucket mit privatem Standardzugriff entwerfen.
3. Objektpfad und Metadatentabelle mit Trail-ID und Eigentümer-ID verknüpfen.
4. Öffentliche GPX-Downloads nur nach Prüfung von Trail-Sichtbarkeit und Downloadfreigabe ausliefern.
5. RLS- und Storage-Tests mit Nutzer A, Nutzer B und anonymem Zugriff durchführen.
6. Erst nach bestandenen Tests die Migration als separaten PR vorbereiten.

**Status:** Bestandsaufnahme und Sicherheitskonzept. Keine Bucket-Änderung, keine Edge-Function-Änderung, keine Migration.
