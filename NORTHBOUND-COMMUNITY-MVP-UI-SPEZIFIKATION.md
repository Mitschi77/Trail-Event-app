# NORTHBOUND – Community-MVP: UI-Spezifikation

**Stand:** 25.11.2026  
**Ziel:** Erste nutzbare Community-Oberfläche innerhalb der bestehenden NORTHBOUND-App.  
**Status:** Umsetzungsspezifikation; noch keine produktive UI oder Datenbankmigration ausgerollt.

## 1. Einordnung und Navigation

Community wird als eigener Hauptbereich in NORTHBOUND ergänzt. Wettkämpfe, Training, Cockpit, Jahresübersicht und Event Planner bleiben unverändert. Community-Trails werden nicht in den offiziellen Eventkatalog gemischt.

Erste Navigation innerhalb des Bereichs:
- **Entdecken** – veröffentlichte öffentliche Trails anderer Mitglieder.
- **Meine Trails** – eigene Entwürfe, veröffentlichte und archivierte Trails.
- **Trail hinzufügen** – öffnet den Erstellungsablauf.

Die Community-Mitgliedschaft setzt kein öffentliches Profil voraus. Autoren ohne freigegebenen Anzeigenamen werden neutral dargestellt.

## 2. Entdecken

### Kopfbereich
- Titel „Trail Community“
- kurze Erklärung: „Entdecke und teile Laufstrecken mit der Community.“
- primäre Aktion „Trail hinzufügen“
- Suchfeld für Name, Region und Beschreibung

### Filter
- Land/Region
- Distanz von/bis
- Höhenmeter von/bis
- Schwierigkeit
- Oberfläche/Untergrund
- GPX-Download verfügbar

Filter sind kombinierbar und auf Mobilgeräten in einem einklappbaren Filterbereich angeordnet.

### Trail-Karte
Jede Trail-Karte zeigt nur vorhandene und freigegebene Angaben:
- Titel und Region
- Distanz und Höhenmeter
- Schwierigkeit
- Sternebewertung und Anzahl Bewertungen, sofern vorhanden
- Bild, sofern öffentlich freigegeben
- Kennzeichnung „GPX verfügbar“, nur wenn beide Download-Freigaben aktiv sind
- Aktion „Details“

Keine exakte private Startadresse anzeigen. Karten-/Routenansicht nur aus freigegebenen Geodaten aufbauen.

## 3. Trail-Details

Abschnitte:
1. Titel, Beschreibung, Region
2. Distanz, Aufstieg, Abstieg, Schwierigkeit und Untergrund
3. Höhenprofil, falls vorhanden und freigegeben
4. Bildergalerie
5. Karte/Routenverlauf, sofern freigegeben
6. GPX-Aktion nur bei öffentlichem veröffentlichtem Trail und aktivierter Trail- sowie Datei-Freigabe
7. Favorit
8. Bewertung und Kommentare
9. „Trail melden“

Private Trails sind ausschließlich in „Meine Trails“ des Eigentümers sichtbar. Eine erratene URL oder direkte Objektadresse darf keine privaten Daten offenlegen.

## 4. Trail hinzufügen – geführter Ablauf

### Schritt 1: Basisdaten
- Titel (Pflicht)
- Beschreibung
- Region und Land
- optionale Startpunkt-Bezeichnung (keine private Wohnadresse voraussetzen)
- Schwierigkeit
- Untergrund

### Schritt 2: Strecke und Kennzahlen
- GPX-Datei hochladen (optional)
- Distanz, Aufstieg und Abstieg aus GPX ableiten, wenn verlässlich möglich
- manuelle Korrektur ermöglichen und als manuell gepflegt kennzeichnen
- Höhenprofil aus GPX erzeugen, sofern die Verarbeitung verfügbar ist
- Datei vor Verarbeitung auf erlaubten Typ und Größenlimit prüfen

### Schritt 3: Bilder
- mehrere JPG-, PNG- oder WebP-Bilder
- Bildunterschrift und Alternativtext
- Reihenfolge festlegen
- Upload-Fortschritt und verständliche Fehlermeldungen anzeigen

### Schritt 4: Sichtbarkeit und Freigaben
- Sichtbarkeit: **Privat** (Standard) oder **Öffentlich**
- Veröffentlichung: Entwurf speichern oder veröffentlichen
- GPX-Download separat aktivieren
- zusätzlich je GPX-Datei eine Download-Freigabe
- UI erklärt: GPX ist nur abrufbar, wenn Trail und Datei den Download erlauben

### Schritt 5: Vorschau und Speichern
- Vorschau zeigt exakt die später sichtbaren Felder
- Aktionen: „Als Entwurf speichern“ und – bei öffentlichem Trail – „Veröffentlichen“
- nach erfolgreichem Speichern zur Detailansicht bzw. „Meine Trails“
- keine Erfolgsmeldung, bevor Supabase den Speichervorgang bestätigt hat

## 5. Meine Trails

Gruppierung:
- Entwürfe
- Öffentlich veröffentlicht
- Privat
- Archiviert

Aktionen nur für Eigentümer:
- bearbeiten
- veröffentlichen/auf privat setzen
- GPX-Downloadfreigabe ändern
- archivieren
- löschen mit Bestätigung

Status und Änderungen müssen mit der Datenbank synchronisiert werden; kein ausschließlich lokaler Browser-Speicher als Quelle der Wahrheit.

## 6. Responsives Verhalten und Barrierefreiheit

- Mobile-first für iPhone, anschließend iPad und Desktop.
- Touch-Ziele mindestens 44 px.
- Formulare auf iPhone einspaltig, auf größeren Displays mehrspaltig.
- Filter auf kleinen Displays einklappbar.
- klare Lade-, Leer-, Fehler- und Offline-Zustände.
- Tastaturbedienbarkeit, sichtbare Fokusmarkierung und beschriftete Eingabefelder.
- dunkles NORTHBOUND-Design mit gut lesbaren Kontrasten; keine neuen Farbwelten neben dem bestehenden Design.

## 7. Technische Integration und Sicherheitsgrenzen

- Bestehende Auth-Session wiederverwenden; keine zweite Anmeldung.
- Daten ausschließlich über angemeldeten Supabase-Kontext und RLS-geschützte Tabellen lesen/schreiben.
- Service-Role-Schlüssel niemals im Browser.
- Uploads nur nach Anlage des passenden Asset-Metadatensatzes und mit Eigentümerpfad.
- GPX-Downloadberechtigung wird serverseitig durch Storage-RLS geprüft; UI-Schalter allein sind keine Sicherheitsgrenze.
- Private Inhalte erhalten keine öffentlichen URLs.
- Community-Daten bleiben getrennt von Event-, Trainings-, Strava- und Planner-Daten.

## 8. Abnahmekriterien für den ersten UI-Schritt

1. Hauptbereich Community ist erreichbar, ohne bestehende Hauptbereiche umzubenennen oder zu entfernen.
2. Entdecken zeigt nur öffentliche veröffentlichte Trails.
3. Meine Trails zeigt nur die eigenen Trails.
4. Nutzer können ohne öffentliches Profil einen Trail als privat speichern.
5. Öffentliche Veröffentlichung ist eine bewusste Aktion.
6. GPX ist nur bei beiden aktiven Freigaben abrufbar.
7. Private Trail-Metadaten und Dateien bleiben auch bei direkter URL-Anfrage geschützt.
8. Speichern, Uploadfehler und Berechtigungsfehler werden verständlich angezeigt.
9. Bestehende Cockpit-, Wettkampf-, Training-, Planner- und Strava-Regressionstests bleiben grün.
