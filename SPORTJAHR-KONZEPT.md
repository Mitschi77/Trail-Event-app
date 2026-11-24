# SPORTJAHR – Produkt- und Datenmodell

Stand: 24. November 2026

## Ziel
Die Anwendung entwickelt sich vom Trailrunning-Manager zu einem universellen Sportjahr-, Trainings- und Wettkampfmanager für **gängige Sportarten**. Trailrunning bleibt ein fachlich besonders tiefes Modul, ist aber nicht mehr die technische oder begriffliche Grenze der Anwendung.

Zentrale Bereiche: **Sport-Cockpit**, **Sportjahr**, **Wettkampf- & Trainingsplanung**, **Sporthistorie**.

## Sportarten – offener Umfang
Das System wird nicht auf eine feste Liste begrenzt. Der Sportartenkatalog muss erweiterbar und konfigurierbar sein. Beispiele für den vorgesehenen Anwendungsbereich:

- **Ausdauer und Outdoor:** Laufen, Trailrunning, Wandern, Radfahren (MTB, Rennrad, Gravel), Schwimmen, Rudern, Kanu/Kajak.
- **Mehrkampf:** Triathlon, Duathlon, Staffel- und weitere Mehrdisziplinformate.
- **Teamsport:** Fußball, Basketball, Handball, Volleyball, Hockey.
- **Rückschlag- und Racketsport:** Tennis, Tischtennis, Badminton, Squash, Padel.
- **Fitness und Kraft:** Fitnessstudio, Krafttraining, Gewichtheben, Functional Fitness.
- **Winter- und Eissport:** Ski alpin, Langlauf, Snowboard, Eislauf.
- **Weitere verbreitete Sportarten:** Turnen, Klettern, Tanzen, Kampfsport und individuelle Sportarten.

Diese Beispiele sind keine abschließende Liste. Benutzerdefinierte Sportarten, Disziplinen und Wettkampfformate müssen ergänzt werden können, ohne Datenbankschema oder App-Grundstruktur ändern zu müssen.

## Verbindliche Begriffshierarchie
1. **Sportart** – z. B. Laufen, Fußball oder Tennis.
2. **Disziplin/Variante** – z. B. Trail-Ultra, MTB, Einzel oder Doppel.
3. **Aktivitätstyp** – Training, Wettkampf, Spiel, Trainingseinheit oder sonstiger Termin.
4. **Aktivität/Ereignis** – konkreter Termin, Spiel, Wettkampf oder Training.
5. **Durchführung/Teilnahme** – persönlicher Datensatz mit Datum, Ergebnis und Verlauf. Wiederholungen bleiben eigenständig.

Sportart und Disziplin sind explizite Felder und dürfen nicht aus dem Namen abgeleitet werden. Der Katalog ist datengetrieben; keine geschlossene Enum-Liste.

## Gemeinsame Datenfelder
- stabile ID, Benutzerzuordnung und optionaler Bezug zu einem öffentlichen Event
- Sportart, Disziplin und Aktivitätstyp
- Titel, Datum/Zeitraum, Ort und Land
- optionale Distanz, Höhenmeter und Dauer
- Status, Notizen, Quelle und Prüfstatus
- Ergebnis-/Leistungsdaten in einer sportartspezifischen Struktur

Nicht jede Sportart benötigt Distanz, Höhenmeter oder Zeit. Fehlende bzw. fachlich unpassende Werte bleiben leer und werden nicht als 0 dargestellt.

## Sportartspezifische Ergebnislogik
Ein universelles Sportjahr darf nicht versuchen, alle Leistungen auf Kilometer und Höhenmeter zu reduzieren.

- **Laufen/Trail:** Distanz, Höhenmeter, Pace, Cut-off, Zwischenzeiten, GPX, Höhenprofil, Pflichtausrüstung, UTMB Index/Kategorie nur wenn zutreffend.
- **Backyard:** eigenständiges rundenbasiertes Format. Rundenanzahl ist die führende Kennzahl; Rundenlänge ist eventbezogen konfigurierbar (6,7 km nur Standardwert), Rundenzeiten, Gesamtzeit und DNF/Ausscheiden bleiben erhalten.
- **Bike:** MTB/Rennrad/Gravel und weitere Varianten; Distanz, Höhenmeter, Zeit, Untergrund, Strecke und Ergebnis.
- **Triathlon/Mehrkampf:** Gesamtzeit plus geordnete Segmente (z. B. Schwimmen, Rad, Laufen) und Wechselzeiten. Ein Segment wird nicht zusätzlich als separate Sportaktivität gezählt.
- **Teamsport:** Mannschaft/Team, Gegner, Spieltermin, Einsatz/Rolle und Ergebnis/Spielstand.
- **Racketsport:** Gegner bzw. Doppelpartner, Matchformat, Sätze und Spielstand.
- **Kraft/Fitness:** Übung, Sätze, Wiederholungen, Gewicht, Dauer und Trainingsprogramm.
- **Schwimmen/Wassersport:** Distanz, Bahnen/Runden, Stil bzw. Disziplin, Zeit und optionale Segmentdaten.
- **Winter-/Bergsport:** Disziplin, Zeit, Höhenmeter, Abfahrten/Routen und sportartspezifische Kennzahlen.

Sportartspezifische Daten werden modular gespeichert. Gemeinsame Kernfelder bleiben schlank; komplexe Mehrfachsegmente erhalten eine strukturierte Segmentdarstellung. Neue Sportarten müssen ohne Migration der Kernstruktur hinzufügbar sein.

## Sport-Cockpit
- nächster Wettkampf, Spieltag oder geplanter Termin
- geplante und absolvierte Aktivitäten
- Jahresziele und Fortschritt pro Sportart
- Trainingsumfang und Verlauf
- sportartspezifische Kennzahlen statt künstlicher Einheitswertung

Kennzahlen verschiedener Sportarten werden nicht unpassend addiert oder in eine künstliche gemeinsame Leistungskennzahl umgerechnet.

## Sportjahr und Kalender
- gemeinsamer chronologischer Kalender für Training, Wettkämpfe, Spiele und relevante Buchungen
- Filter nach Sportart, Disziplin, Aktivitätstyp und Zeitraum
- passende Symbole und kompakte sportartspezifische Informationen
- mehrtägige Ereignisse mit korrekter Dauer
- Unterkunft und Buchung bleiben mit dem jeweiligen Ereignis verknüpft

## Historie und Wiederholungen
Jede Durchführung speichert eigenes Datum, Ergebnis, tatsächliche Werte und Bewertung. Frühere Ergebnisse dürfen nicht überschrieben werden. Team-, Einzel- und Mehrkampfresultate müssen unterscheidbar sein.

## Migration und Rückwärtskompatibilität
1. Bestehende Event-IDs, Strecken-IDs, Planner-Einträge, Ergebnisse, UTMB-Daten, GPX-Referenzen und Unterkunftsverknüpfungen bleiben erhalten.
2. Der bestehende Lauf-/Trail-Veranstaltungsbestand bleibt unverändert und wird nicht pauschal umklassifiziert.
3. Neue Sportarten und Disziplinen werden additiv und datengetrieben ergänzt.
4. Sportartspezifische Kennzahlen dürfen nicht in falschen Modulen erscheinen.
5. Keine automatische Umdeutung oder Löschung bestehender Daten. Migrationen benötigen Altbestands-, Duplikat- und Wiederholungstests.

## Navigation – Zielbild
- Cockpit → **Sport-Cockpit**
- Jahresübersicht → **Sportjahr**
- Planung → **Wettkampf- & Trainingsplanung**
- Laufhistorie → **Sporthistorie**
- Events bleibt als Veranstaltungsdatenbank erhalten

Beschriftungen werden erst umgestellt, wenn die zugehörigen Ansichten und Filter fachlich korrekt funktionieren.

## Umsetzungsreihenfolge
1. Offenes Sportarten-/Disziplinmodell und Kompatibilität absichern.
2. Gemeinsame Aktivitäten und sportartspezifische Ergebnisstrukturen implementieren.
3. Bestehende Lauf-/Trail-Funktionen unverändert integrieren.
4. Weitere Sportarten modular ergänzen; zuerst generische Erfassung, danach spezialisierte Ergebnisansichten.
5. Sportjahr-Kalender und Sport-Cockpit sportartenübergreifend aufbauen.
6. Navigation und Beschriftungen auf Sportjahr umstellen.
7. Regressionstests für Altbestand, Wiederholungen und sportartspezifische Kennzahlen.

## Nicht-Ziele
- Keine geschlossene Sportartenliste.
- Keine künstliche Umrechnung unterschiedlicher Sportleistungen in eine Einheitskennzahl.
- Keine Löschung oder pauschale Neuzuordnung bestehender Veranstaltungen.
- Keine produktive Datenbankmigration ohne gesonderte Sicherheits- und Abnahmeprüfung.
