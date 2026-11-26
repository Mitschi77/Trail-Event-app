# NORTHBOUND – Booking-Partnerfähigkeit

**Status:** Vorbereitung, keine Affiliate-Freigabe und keine produktive Booking.com-Integration.
**Basis:** `main` nach PR #431, Commit `2a4ad6785ede042d74c5dd4973a163c0cc0c8eb0`.

## Ziel

Die bestehende Unterkunftssuche von NORTHBOUND soll nach erfolgreicher Aufnahme in ein Affiliate-Programm externe Unterkunftsangebote mit korrekt zugeordneten Partnerlinks darstellen. Buchung und Zahlung bleiben zunächst beim Anbieter.

## Verbindliche Produktregeln

- Keine Eigenbuchungen über eigene Affiliate-Links.
- Keine Affiliate-ID, Tracking-Parameter oder Partnerkennung erfinden oder vor Freigabe verwenden.
- Externe Angebote und Buchungsziele klar als solche kennzeichnen.
- Affiliate-Beziehungen unmittelbar und verständlich bei den betroffenen Unterkunftslinks offenlegen.
- Unterkunftssuche bleibt zielorientiert: Zielort hat Vorrang vor Startort; vorhandene Radien 1/3/5/10 km bleiben erhalten.
- Keine Preise, Verfügbarkeiten, Bewertungen oder Angebotsdaten vortäuschen. Ohne bestätigte API-Daten nur externe Suchlinks anbieten.
- Externe Buchung und Zahlung erfolgen in der ersten Integrationsstufe beim Anbieter.

## Vor einer öffentlichen Affiliate-Aktivierung erforderlich

1. Schriftliche Freigabe durch CJ/Booking.com für NORTHBOUND und den konkreten Werbekanal.
2. Bestätigte Affiliate-ID/AID und genehmigte Link-/Tracking-Methode.
3. Klärung, ob Booking.com-Demand-API-Zugang separat erteilt wird; Affiliate-Freigabe allein ist keine API-Freigabe.
4. Vollständige Anbieter- und Steuer-/Zahlungsdaten nach den tatsächlichen Anforderungen des Partnerprogramms.
5. Öffentliche, zutreffende Betreiber- und Kontaktangaben sowie rechtlich geprüfte Impressums- und Datenschutzhinweise.
6. Prüfung der Plattformrichtlinien zu Werbekanälen, Software, Deeplinks, Markenverwendung und Such-/Metasuchfunktionen.

## Geplante UI-Kennzeichnung

Vor Partnerfreigabe darf die Oberfläche nur einen neutralen Hinweis für externe Buchungslinks anzeigen. Ein Affiliate-Hinweis darf erst dann eine tatsächliche Vergütung behaupten, wenn solche Links aktiv sind.

Vorgesehener Text bei aktivierten Affiliate-Links:

> **Partnerhinweis:** Einige Links zu Unterkünften sind Affiliate-Links. Wenn du darüber buchst, kann NORTHBOUND eine Provision erhalten. Für dich ändert sich am Buchungspreis nichts.

Der Hinweis muss in unmittelbarer Nähe des Unterkunftsbereichs und zusätzlich nachvollziehbar in den Informationen/Datenschutzhinweisen erscheinen. Die konkrete rechtliche Formulierung ist vor Veröffentlichung zu prüfen.

## Noch fehlende Angaben – nicht erfinden

- Rechtlicher Betreiber / vollständiger Name bzw. Unternehmensbezeichnung
- ladungsfähige Anschrift
- Kontakt-E-Mail
- ggf. Register-/USt-Angaben, falls tatsächlich vorhanden und einschlägig
- CJ Publisher-ID und Booking.com AID nach Freigabe
- Demand-API-Key und API-Freigabe, falls erteilt

## Technische Umsetzung nach Freigabe

- Partnerlinks zentral und konfigurierbar verwalten; keine Kennungen im Quellcode verteilen.
- Partnerlinks serverseitig bzw. sicher konfigurieren; keine geheimen API-Schlüssel im Browser.
- Kennzeichnung nur für tatsächlich affiliate-markierte Links ausgeben.
- Linkziele und Parameter gegen erlaubte Booking.com-Domains prüfen.
- Tracking- und Datenschutzanforderungen vor Aktivierung prüfen.
- Tests für mobile/desktop Darstellung, Zielort-Fallback, Radien, Link-Attribution und fehlende Partnerkonfiguration.
- Keine produktive Aktivierung ohne Freigabe und Abnahme.

## Abgrenzung dieses Arbeitsschritts

Dieses Dokument ist eine technische und redaktionelle Vorbereitung. Es ersetzt keine Rechtsberatung, keine steuerliche Prüfung und keine Partnerfreigabe. Es werden keine Verträge akzeptiert, keine persönlichen Steuerdaten ergänzt und keine Affiliate-Links aktiviert.
