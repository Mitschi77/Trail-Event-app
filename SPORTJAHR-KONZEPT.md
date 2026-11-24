# SPORTJAHR – Produkt- und Datenmodell

Stand: 24. November 2026

## Ziel
Die Anwendung entwickelt sich vom Trailrunning-Manager zu einem sportartenübergreifenden Jahres- und Wettkampfplaner. Trailrunning bleibt eine wichtige Disziplin, ist aber nicht mehr die begriffliche oder technische Klammer für das gesamte Jahr.

Zentrale Bereiche: **Sport-Cockpit**, **Sportjahr**, **Wettkampf- & Trainingsplanung**, **Sporthistorie**.

## Sportarten und Disziplinen
Erste Ausbaustufe:
- **Laufen**: Straßenlauf, Halbmarathon, Marathon, Trail, Ultra, Backyard.
- **Bike**: Mountainbike, Rennrad und Gravel.

Weitere Sportarten müssen später ergänzbar sein, ohne das Jahresmodell neu aufzubauen.

## Verbindliche Begriffshierarchie
1. **Sportart** – Laufen oder Bike.
2. **Disziplin** – Marathon, Trail-Ultra, MTB, Rennrad, Gravel usw.
3. **Aktivitätstyp** – Wettkampf, Training oder sonstiger Termin.
4. **Aktivität/Veranstaltung** – konkreter Termin mit Strecke und Daten.
5. **Durchführung** – persönliche Teilnahme an einem bestimmten Datum/Jahr. Eine Veranstaltung kann mehrfach absolviert werden.

Sportart und Disziplin sind explizite Felder. Sie dürfen langfristig nicht aus dem Namen einer Veranstaltung abgeleitet werden.

## Gemeinsame Datenfelder
- stabile ID und optionale externe Veranstaltungs-ID
- Sportart, Disziplin und Aktivitätstyp
- Name, Datum/Zeitraum, Ort und Land
- Distanz (km, optional), Höhenmeter bergauf (m, optional)
- geplante und tatsächliche Dauer
- Status: geplant, absolviert, abgesagt oder DNF
- Notizen, Quelle und Prüfstatus

Nicht jede Sportart benötigt jedes Feld. Fachlich unpassende Werte bleiben leer und werden nicht als 0 dargestellt.

## Sportartspezifische Daten

### Laufen / Trail
Cut-off, Zwischenzeiten, UTMB Index/Kategorie (nur falls zutreffend), GPX, Höhenprofil, Verpflegungsstellen, Pflichtausrüstung, Backyard-Runden, Platzierung und DNF.

### Bike
Bike-Disziplin (MTB/Rennrad/Gravel), GPX, Höhenprofil, Zeit, Platzierung, DNF, Untergrund/Streckenhinweise und Bike-spezifische Ausrüstung.

UTMB-Felder werden ausschließlich bei passenden Laufveranstaltungen angezeigt. Bike-Aktivitäten erhalten keine UTMB-Werte.

## Sport-Cockpit
Sportartenübergreifend anzeigen:
- nächster geplanter Wettkampf oder Termin
- geplante und absolvierte Aktivitäten
- Jahresdistanz und Höhenmeter getrennt nach Sportart
- Trainingsumfang und Verlauf
- persönliche Jahresziele und Fortschritt

Lauf- und Bike-Kilometer werden getrennt ausgewiesen. Gemeinsame Zeit- oder Aktivitätszahlen können ergänzend erscheinen. Es gibt keine künstliche gemeinsame Leistungskennzahl.

## Sportjahr und Kalender
- gemeinsamer chronologischer Kalender für Wettkämpfe, Training und relevante Buchungen
- Filter für Sportart und Disziplin
- sportartspezifische Symbole innerhalb der NORTHBOUND-Farbwelt
- tatsächliche Dauer bei mehrtägigen Wettkämpfen
- Unterkunft und Buchung bleiben mit dem jeweiligen Ereignis verknüpft

## Historie und Wiederholungen
Jede Durchführung speichert ihr eigenes Datum, Ergebnis, tatsächliche Werte und ihre eigene Bewertung. Frühere Ergebnisse dürfen nicht überschrieben werden.

## Migration und Rückwärtskompatibilität
1. Bestehende Event-IDs, Strecken-IDs, Planner-Einträge, Ergebnisse, UTMB-Daten, GPX-Referenzen und Unterkunftsverknüpfungen bleiben erhalten.
2. Der vorhandene Veranstaltungsbestand bleibt zunächst Laufbestand; vorhandene Trail-/Marathon-Unterscheidungen bleiben bestehen.
3. Neue Sportart- und Disziplinfelder werden additiv eingeführt. Alte gespeicherte Planungen müssen weiter lesbar bleiben.
4. Bike-Aktivitäten werden separat in das Sportjahr aufgenommen und dürfen nicht in Trail-/UTMB-Auswertungen geraten.
5. Keine automatische Umdeutung vorhandener Laufdaten. Migrationen erhalten Tests für Altbestände und Wiederholungen.

## Navigation – Zielbild
- Cockpit → **Sport-Cockpit**
- Jahresübersicht → **Sportjahr**
- Planung → **Wettkampf- & Trainingsplanung**
- Laufhistorie → **Sporthistorie**
- Events bleibt als Veranstaltungsdatenbank erhalten

Beschriftungen werden erst umgestellt, wenn die zugehörigen Ansichten und Filter fachlich korrekt funktionieren.

## Umsetzungsreihenfolge
1. Gemeinsames Datenmodell und Kompatibilitäts-/Migrationstests.
2. Sportart- und Disziplinfelder in Planung und Historie.
3. Bike-Aktivitäten und Bike-Wettkämpfe ergänzen.
4. Sportjahr-Kalender mit Sportartfiltern.
5. Sport-Cockpit mit getrennten Kennzahlen und nächsten Terminen.
6. Navigation und Beschriftungen auf Sportjahr umstellen.
7. Bestehende Lauf-/Trail-/UTMB-Funktionen vollständig regressionsprüfen.

## Nicht-Ziele der ersten Stufe
- Keine neue Bike-Plattform-Synchronisation ohne gesonderte Freigabe.
- Keine Umrechnung von Lauf- und Bike-Leistung in eine künstliche gemeinsame Kennzahl.
- Keine Löschung oder pauschale Neuzuordnung bestehender Veranstaltungen.
