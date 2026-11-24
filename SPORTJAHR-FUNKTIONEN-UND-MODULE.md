# SPORTJAHR – Funktions- und Modulplanung

Stand: 24. November 2026

## 1. Produktprinzip

Das Sportjahr ist die gemeinsame persönliche Oberfläche für Sport, Training, Wettkämpfe, Spiele, Termine und Historie. Die Navigation und Grundbedienung sind einheitlich. Eingabemasken, Kennzahlen und Auswertungen richten sich nach der ausgewählten Sportart und Disziplin.

Es gibt keine Pflicht, jede Sportart mit Distanz, Höhenmetern oder Pace abzubilden. Fachlich unpassende Felder werden ausgeblendet statt mit künstlichen Nullwerten gefüllt.

## 2. Hauptnavigation

### Sport-Cockpit
Startseite mit:
- nächstem Termin bzw. Wettkampf
- heutigen/geplanten Trainingseinheiten
- kurzem Jahresfortschritt je aktiver Sportart
- persönlichen Zielen und offenen Aufgaben
- zuletzt erfassten Aktivitäten
- Hinweisen zu fehlenden Angaben oder anstehenden Planungen

Das Cockpit zeigt kompakte Zusammenfassungen. Detaillierte Tabellen und Pflegefunktionen gehören in die jeweiligen Fachbereiche.

### Sportjahr
Chronologischer Jahreskalender für:
- Training
- Wettkämpfe und Veranstaltungen
- Spiele und Spieltage
- Mehrtagesveranstaltungen
- relevante Buchungen und Reisezeiträume

Filter: Jahr, Sportart, Disziplin, Aktivitätstyp und Status. Ein Eintrag öffnet seine Detailansicht.

### Trainingsplanung
- wiederkehrende Trainingseinheiten und einzelne Termine
- Trainingsziele und optionale Trainingsblöcke
- Sportart-/Disziplinzuordnung
- geplante gegenüber tatsächlich absolvierten Einheiten
- Notizen und Belastungs-/Umfangswerte, soweit für die Sportart passend

### Wettkampf- und Spielplanung
- Wettkampf, Spiel oder Veranstaltung auswählen bzw. selbst anlegen
- Datum, Ort, Disziplin, Kategorie und persönliche Priorität
- Teilnahme-/Meldestatus und wichtige Fristen
- optional Reise, Unterkunft und Buchungen verknüpfen
- wiederkehrende Teilnahme als neue Durchführung planen, nicht alte Ergebnisse überschreiben

### Sporthistorie
- abgeschlossene Aktivitäten und Teilnahmen
- Filter und Suche über Sportarten hinweg
- Detailergebnisse und persönliche Bewertungen
- Vergleiche nur innerhalb fachlich vergleichbarer Disziplinen
- Verlauf und Wiederholungen einer Veranstaltung

### Sportarten & Einstellungen
- Sportarten und Disziplinen aktivieren/deaktivieren
- eigene Sportarten und Varianten ergänzen
- bevorzugte Einheiten und Standardwerte festlegen
- persönliche Jahresziele pro Sportart verwalten

### Daten & Verwaltung
- Datenqualität und offene Angaben
- Import-/Exportfunktionen
- Synchronisations- und Verbindungsstatus
- Datenprüfung und Änderungsfreigaben
- Datenschutz- und Kontoeinstellungen

Die Eventdatenbank bleibt als eigener Bereich verfügbar. Ihre Qualitätsanzeige und Datenpflege gehören in Daten & Verwaltung, nicht an den Anfang der Eventliste.

## 3. Einheitlicher Aktivitätsablauf

1. Benutzer wählt Sportart.
2. Benutzer wählt eine vorhandene Disziplin oder legt eine Variante an.
3. Benutzer wählt Training, Wettkampf, Spiel oder Termin.
4. Die Eingabemaske zeigt nur gemeinsame und für diese Disziplin passende Felder.
5. Bei zusammengesetzten Wettkämpfen können geordnete Segmente ergänzt werden.
6. Ergebnis und Status werden als eigene persönliche Durchführung gespeichert.
7. Cockpit, Sportjahr und Historie lesen denselben Aktivitätsdatensatz; sie erzeugen keine getrennten Kopien.

## 4. Eingabemasken nach Sportprofil

### Ausdauer / Outdoor
Gemeinsame Angaben: Datum, Startzeit, Dauer, Distanz (optional), Höhenmeter (optional), Strecke, Status und Notizen.
Laufen/Trail kann zusätzlich Pace, GPX, Cut-off, Zwischenzeiten, UTMB Index und Pflichtausrüstung anbieten, wenn fachlich zutreffend.
Bike kann zusätzlich Bike-Typ, Untergrund und technische Streckenhinweise anbieten.

### Backyard
Eigene Ergebnisansicht mit:
- absolvierte Runden
- Rundenlänge (Eventwert; 6,7 km nur Standard)
- Rundenzeiten bzw. Zeitstempel
- Gesamtzeit und daraus abgeleitete Distanz
- Status: beendet, DNF/Ausscheiden
- optionale Höhenmeter und Platzierung

Die Rundenanzahl steht optisch und rechnerisch im Vordergrund.

### Triathlon / Mehrkampf
- Gesamtveranstaltung und Gesamtzeit
- geordnete Segmente mit Sportart, Distanz und Zeit
- Wechselzeiten separat
- Ergebnis pro Segment und Gesamtresultat
- Segmente werden nicht als zusätzliche Einzelaktivitäten summiert

### Teamsport
- Team, Gegner, Heim/Auswärts
- Spieltag und Wettbewerb/Liga
- Ergebnis/Spielstand
- persönliche Rolle/Einsatzzeit optional
- Mannschaftsergebnis und persönliche Teilnahme getrennt darstellbar

### Racketsport
- Einzel/Doppel
- Gegner bzw. Partner
- Matchformat und Satzresultate
- Spielstand und Ausgang
- Wettbewerb/Turnier optional

### Kraft / Fitness
- Übung und Trainingsprogramm
- Sätze, Wiederholungen, Gewicht
- Pausen und Dauer optional
- persönliche Bestleistungen je Übung
- Trainingsvolumen nur innerhalb sinnvoll vergleichbarer Übungen berechnen

### Schwimmen / Wasser
- Becken/Freiwasser bzw. Variante
- Distanz, Bahnen, Stil und Zeit
- Splits/Abschnitte optional
- bei anderen Wassersportarten eigene passende Felder

### Winter / Berg / weitere Sportarten
Generische Erfassung ist sofort möglich. Spezialisierte Messwerte werden je Sportprofil ergänzt, wenn die konkrete Sportart implementiert wird. Keine erfundenen Standardfelder erzwingen.

## 5. Cockpit-Kennzahlen und Aggregation

- Aktivitäten und Termine können sportartenübergreifend gezählt werden.
- Distanz, Höhenmeter, Trainingsvolumen und Leistungswerte werden nur je geeigneter Sportart/Disziplin aggregiert.
- Teamspielstände, Tennissätze, Backyard-Runden und Krafttrainingsvolumen bleiben getrennte Kennzahlentypen.
- Mehrkampfsegmente werden nicht doppelt gezählt.
- Geplante, absolvierte, abgesagte und DNF-Aktivitäten bleiben unterscheidbar.
- Fehlende Daten werden als „nicht erfasst“ behandelt, nicht als Nullleistung.

## 6. Rechte, Speicherung und Synchronisierung

- Persönliche Aktivitäten gehören dem angemeldeten Benutzer.
- Jede Aktivität erhält eine stabile ID und einen Eigentümer.
- Wiederholte Teilnahmen werden separat gespeichert.
- Bestehende Trail-Daten bleiben bis zur geprüften Migration im bisherigen Speicherweg.
- Keine Änderung an produktiven Tabellen ohne separate Migration, RLS-Prüfung und Tests.
- Konflikte zwischen Geräten benötigen nachvollziehbare Zeitstempel und eine definierte Konfliktstrategie; stilles Überschreiben ist nicht zulässig.

## 7. Umsetzungsphasen

### Phase 1 – sichere Grundlage
- offener Sportarten-/Disziplinenkatalog
- gemeinsame Aktivitätsverwaltung
- RLS und Data-API-Konfiguration
- Testfälle für Altbestand und Mehrbenutzerisolation

### Phase 2 – Sportjahr-Grundfunktionen
- Cockpit als Startbereich
- Jahreskalender mit Sportartfiltern
- Aktivität anlegen, bearbeiten, abschließen und historisieren
- einfache Jahresziele und Kennzahlen je Sportart

### Phase 3 – Sportprofile
- Lauf/Trail vollständig weiterführen
- Bike
- Triathlon/Mehrkampf
- Teamsport und Racketsport
- Kraft/Fitness
- Schwimmen/Wasser sowie weitere Sportprofile schrittweise

### Phase 4 – Planung und Komfort
- Trainingsblöcke und wiederkehrende Termine
- Wettkampf-/Spielplanung
- Reise, Unterkunft und Buchungen
- Import/Export und optionale externe Plattformanbindungen

## 8. Abnahme- und Regressionstests

- Cockpit ist der tatsächliche Startbereich; kein automatischer Wechsel in die Jahresübersicht.
- Sportjahr zeigt alle Aktivitätstypen chronologisch und filterbar.
- Sportartwechsel blendet unpassende Eingabefelder aus.
- Neue Sportart kann ohne Schemaänderung ergänzt werden.
- Backyard-Runden und Triathlonsegmente werden korrekt dargestellt und aggregiert.
- Team- und Racket-Ergebnisse lassen sich erfassen.
- Krafttraining speichert Übung/Sätze/Wiederholungen/Gewicht.
- Wiederholte Teilnahmen überschreiben keine älteren Ergebnisse.
- Segmente werden nicht doppelt gezählt.
- Bestehende Lauf-/Trail-/UTMB-/GPX-Funktionen bestehen Regressionstests.
- Daten bleiben benutzergetrennt und synchronisieren ohne stillen Datenverlust.

## 9. Bewusst nicht Teil dieser Phase

- Keine automatische Umstellung aller bestehenden Ansichten, bevor neue Funktionen verfügbar sind.
- Keine produktive Datenbankmigration allein aufgrund dieses Plans.
- Keine künstliche sportartenübergreifende Gesamtpunktzahl.
- Keine vollständige Spezialauswertung jeder Sportart in einem einzigen Entwicklungsschritt.
