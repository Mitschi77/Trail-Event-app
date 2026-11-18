# Trail Events – Funktions- und Datenprüfung

Prüfstand: 17. November 2026. Diese Übersicht beschreibt den Quellcode und die Eventdaten im Repository; sie ersetzt keinen vollständigen Test auf einem echten iPhone.

## Umgesetzte Funktionen

- Sortierbare Event- und Streckenlisten mit Jahresplanung und Laufhistorie.
- Jahresübersicht mit Eventdetails, Höhenprofil-/Streckendaten und Cut-off-/Zeitangaben, soweit vorhanden.
- Dark Mode und iPhone-taugliche Web-App-Oberfläche.
- Lokale Datenspeicherung; optionaler Cloud-Abgleich über Supabase.
- GPX-, TCX- und Garmin-FIT-Dateiimport für Strecken oder absolvierte Läufe.
- FIT-Import übernimmt – sofern in der Datei enthalten – Startzeit, Distanz, Höhenmeter, Dauer, durchschnittlichen/maximalen Puls und Kalorien.
- Dateiimporte werden mit SHA-256-Fingerprints gegen erneuten Import derselben Datei abgesichert.
- Manuelle Platzierung und Bewertung bleiben bei der Ergänzung eines Laufs durch eine Aktivitätsdatei erhalten.
- Automatischer Abgleich offizieller Eventdaten über einen GitHub-Actions-Workflow.
- Saisonsteuerung mit A/B/C-Rennprioritäten, Trainingsphasen und Erholungsfenstern; die Berechnung berücksichtigt das tatsächliche Event-Enddatum, Laufdauer und DNF.
- Export geplanter Rennen in den Kalender (iCalendar/ICS), inklusive mehrtägiger Events.
- Offline-App-Shell mit lokalem Cache für App-Oberfläche, Symbole und offiziellen Datumsfeed; der Datumsfeed wird online aktualisiert und offline aus dem Cache geladen.
- Saisonprioritäten werden in privaten JSON-Backups und im persönlichen Supabase-Cloudstand mitgesichert.
- Marathon, Halbmarathon und Straßenlauf werden bei geplanten Trail-Höhenmetern und Maximalzeiten passend behandelt; Backyard ohne Maximalzeit.

## Datenprüfung

Im aktuell veröffentlichten Hauptdatensatz befinden sich 125 Events und 363 Strecken. Der offizielle Datumsfeed enthält 125 Einträge: 108 mit zuletzt bestätigten Terminen, 16 ungeklärte und 1 eingestellten Event. Die Zählung wurde am 18. November 2026 direkt aus `index.html` und `event-dates.json` ermittelt. Frühere Prüfberichte mit 129 Events / 387 Strecken sind veraltet und dürfen nicht als aktueller Bestand verwendet werden.

| Feld | Fehlende Angaben im aktuellen Hauptdatensatz |
|---|---:|
| Distanz | 9 |
| Höhenmeter | 34 |
| Maximalzeit | 265 |
| Streckendatum | 72 |
| Startzeit / Startangabe | 2 |
| Separater Startpunkt | 207 |
| Land | 3 |
| Höhenprofil | 191 |
| Cut-off-Daten | 263 |

Fehlende Werte sind nicht automatisch Fehler: Manche Veranstalter veröffentlichen Cut-off-Zeiten, GPX-Dateien oder Höhenprofile erst spät oder gar nicht. Nicht belegte Werte dürfen nicht geschätzt werden. Marathonstrecken werden in der Anzeige bewusst ohne Höhenmeter und Maximalzeit dargestellt; Backyard-Läufe ohne Maximalzeit.

Der Datumsfeed enthielt bei der Prüfung 109 als verifiziert, 19 als unbestätigt und 1 als eingestellt gekennzeichnete Events. Ein Status „verifiziert“ kann auf manuell geprüften offiziellen Angaben beruhen, auch wenn eine Webseite beim letzten automatischen Abruf nicht erreichbar war. Vor einer konkreten Rennanmeldung sollte die Veranstalterseite weiterhin maßgeblich sein.

## Verbesserungen, priorisiert

### P0 – vor intensiver Nutzung

- Native iOS-Simulator-Builds und die GitHub-Pages-Veröffentlichung vollständig abwarten und auf einem echten iPhone prüfen.
- GPX/TCX/FIT-Dateien aus realen Garmin- und Strava-Exporten testen; insbesondere Dateien ohne GPS-Track, ohne Höhenwerte, mit mehreren Tracksegmenten und über Mitternacht.
- Backup/Export und Wiederherstellung vor dem Wechsel von Safari in die native App prüfen. Safari-LocalStorage wird nicht automatisch in den separaten Speicher der nativen App übernommen.
- Cloud-Synchronisierung mit zwei Testkonten prüfen: Nutzertrennung, Konflikte, Offline-Änderungen und Wiederherstellung.

### P1 – Datenqualität und Trainingsplanung

- Fehlende Daten als „nicht veröffentlicht“, „noch nicht geprüft“ oder „technisch nicht abrufbar“ unterscheiden.
- Event- und Streckendaten nach jeder Änderung automatisch validieren: Datum, Distanz, Höhenmeter, Zeitlimit, Zielort und eindeutige IDs.
- Für jeden Wert die offizielle Quelle und den Prüfzeitpunkt anzeigen.
- GPX-/FIT-Höhenprofile mit offiziellen Höhenprofilen vergleichen; GPS-Höhenwerte können verrauscht sein und Aufstieg überschätzen.
- Bei Mehrtagesveranstaltungen wird der jeweilige Streckentag für den Rennstart verwendet; die Regeneration beginnt nach dem gesamten Event-Enddatum.

### P1 – Strava und Garmin

- Dateiimport ist bereits verfügbar und benötigt keine API-Zugangsdaten.
- Direkte Strava-Synchronisierung erfordert eine registrierte API-App, OAuth und einen serverseitigen Token-Speicher. Neue Apps starten im Single-Player-Modus; zusätzliche Athletenfreigabe und Strava-Prüfung sind erforderlich, sobald der Nutzerkreis wächst.
- Direkte Garmin-Mehrnutzer-Synchronisierung benötigt eine passende Freigabe im Garmin Connect Developer Program. Die Personal API ist für die eigenen Daten gedacht; Starter- und Enterprise-Zugänge unterscheiden sich bei Push/Pull und Historienzugriff.
- Erst nach Zugang/Freigabe sollten echte „Verbinden“-Schaltflächen aktiviert werden. Keine Zugangsdaten oder Tokens im Browser oder im Repository speichern.

### P2 – Bedienbarkeit und neue Funktionen

- Aktivität nach dem Import einer anderen Strecke zuordnen oder Zuordnung korrigieren können.
- Export der gesamten Laufhistorie als CSV/JSON ergänzen.
- Trainingssteuerung weiter verfeinern: aktuelle Erholungswerte sind bewusst eine grobe Heuristik aus Distanz, Höhenmetern, Dauer und DNF; subjektive Belastung, Schlaf und individuelle Trainingshistorie fehlen noch.
- Offline-Kartenkacheln und ein klarer Offline-Status fehlen noch. Supabase-Cloud, Karten von OpenStreetMap und das Laden des Garmin-FIT-Decoders benötigen weiterhin eine Internetverbindung.

## Grenzen der Prüfung

- Die automatischen JavaScript- und Kennzahlen-Regressionstests laufen in GitHub Actions.
- Ein erfolgreicher Simulator-Build ist noch kein Test auf einem echten iPhone und keine App-Store-Freigabe.
- Strava- und Garmin-Live-OAuth können ohne die jeweiligen Entwicklerzugänge, Callback-Domains und Server-Secrets nicht end-to-end getestet werden.
- Offizielle Renntermine und Cut-offs können sich nach dem Prüfzeitpunkt ändern.