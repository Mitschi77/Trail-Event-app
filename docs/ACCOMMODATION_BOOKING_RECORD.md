# Unterkunfts-Buchungsakte – Umsetzungsspezifikation

## Ziel

Jeder gespeicherte Unterkunftsaufenthalt erhält eine eigene, nachvollziehbare Buchungsakte. Sie wird innerhalb der bestehenden Jahresübersicht unter „Unterkunft & Buchung“ angezeigt und bleibt dem konkreten Event, Planungsjahr und Aufenthalt zugeordnet.

Diese Änderung soll die bestehende Buchungsverwaltung erweitern, nicht ersetzen.

## Ausgangslage im Hauptzweig

- Unterkunftsdaten liegen im privaten Planner-Bereich `trailPrivateBookings`.
- Mehrere Aufenthalte pro Event werden über `stays[]` verwaltet; ältere Einzelbuchungen werden über die bestehende Legacy-Konvertierung weiterhin gelesen.
- Original-Bestätigungsmails können bereits als `.eml` im privaten Storage-Bucket `trail-private-documents` abgelegt werden. Die aktuelle Zuordnung erfolgt jedoch auf Event-Ebene über `trailPrivateInvoices`, nicht zu einem einzelnen Aufenthalt.
- Die private Cloud-Synchronisierung und Anmeldung sind Voraussetzung für persönliche Buchungsdaten.
- Die bestehende Buchungsakte darf ältere Einträge und Belege nicht verlieren.

## Datenmodell – additive Erweiterung

Jeder Aufenthalt erhält optional eine stabile `id` (bei neuen Aufenthalten bereits vorhanden; bei Legacy-Datensätzen beim ersten sicheren Bearbeiten ergänzen, ohne andere Felder zu überschreiben).

Optionale Felder pro Aufenthalt:

- `provider`: Anbieter / Buchungsportal (z. B. Booking.com, Airbnb, direkt beim Hotel)
- `bookingReference`: Buchungs- oder Reservierungsnummer
- `cancellationUntil`: Datum/Uhrzeit der kostenlosen Stornierungsfrist, sofern bekannt
- `cancellationPolicy`: Freitext zur Stornierungsregel
- `contactName`, `contactEmail`, `contactPhone`: optionale Kontaktdaten

Belege werden als separate Dokumentmetadaten geführt und über `eventId + stayId` eindeutig einem Aufenthalt zugeordnet. Empfohlene Metadaten:

- `id`, `eventId`, `stayId`
- `storagePath` (privater Storage-Pfad, niemals öffentlicher URL)
- `originalName`, `mimeType`, `size`
- `documentType`: `booking_confirmation`, `invoice`, `payment_receipt`, `cancellation`, `correspondence`, `other`
- `uploadedAt`, optional `note`

Die bestehende eventweite `trailPrivateInvoices`-Liste bleibt unverändert lesbar. Bereits gespeicherte `.eml`-Nachrichten dürfen nicht automatisch einer Unterkunft zugeordnet werden; dafür ist eine bewusste manuelle Zuordnung erforderlich.

## Oberfläche

Innerhalb jeder Unterkunftskarte einen aufklappbaren Bereich „Buchungsakte“ ergänzen:

1. Anbieter und Buchungsnummer
2. Stornierungsfrist und Stornierungsbedingungen
3. Dokumentliste mit Dateiname, Dokumenttyp und Upload-Datum
4. Aktion „Beleg hinzufügen“ für PDF und EML
5. Dokument öffnen / herunterladen über kurzlebige, authentifizierte Storage-URLs
6. Dokument einzeln entfernen, mit Bestätigung

Die Buchungsakte bleibt auch bei mehreren Aufenthalten je Event eindeutig getrennt. In der Jahresübersicht werden keine privaten Dokumentinhalte öffentlich gerendert.

## Upload- und Datenschutzregeln

- Anmeldung und Cloud-Bereitschaft vor jedem Upload, Abruf und Löschen prüfen.
- Ausschließlich den bestehenden privaten Bucket `trail-private-documents` verwenden; keine öffentlichen URLs erzeugen.
- Dateityp anhand MIME-Typ und Dateiendung prüfen; PDF und EML zunächst unterstützen.
- Eine klare Größenbegrenzung und verständliche Fehlermeldung anzeigen.
- Storage-Pfad mit Benutzer-ID, Event-ID und Aufenthalts-ID strukturieren.
- Bei Löschung zuerst den Storage-Vorgang sicher behandeln und Metadaten konsistent halten; Fehler dürfen keinen scheinbar erfolgreichen Löschstatus erzeugen.
- Keine automatische E-Mail-Weiterleitung, kein Zugriff auf Mailkonten und keine automatische Buchung.
- Keine OCR-/KI-Auslesung von Buchungsnummern oder Preisen in dieser Ausbaustufe.

## Rückwärtskompatibilität und Tests

- Bestehende `trailPrivateBookings`, `trailPrivateInvoices` und Cloud-Backup-Formate weiter unterstützen.
- Keine bestehenden Belege verschieben oder löschen.
- Legacy-Einzelbuchungen bleiben sichtbar und editierbar.
- Tests für mehrere Aufenthalte desselben Events, Dokumentzuordnung per `stayId`, getrennte Dokumentlisten, private Storage-URLs, Upload-Fehler, Löschfehler, Abmeldung und Cloud-Synchronisierung ergänzen.
- Nach Bereitstellung manuell auf iPhone Safari, iPad und Desktop testen.

## Abgrenzung dieses Spezifikations-PRs

Dieser PR dokumentiert nur die fachliche und technische Spezifikation. Er ändert weder App-Code noch Datenbank, Storage-Regeln oder bestehende Nutzerdaten. Die eigentliche UI-/Funktionsimplementierung erfolgt in einem separaten PR nach Prüfung dieser Spezifikation.
