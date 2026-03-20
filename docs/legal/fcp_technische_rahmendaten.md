# FCP – Technische Rahmendaten fuer Rechtstexte

Stand: 16. Maerz 2026

Dieses Dokument dient als technische Arbeitsgrundlage fuer juristische Finalisierung von Datenschutz, Nutzungsbedingungen, AVV und Impressums-/Rollenklaerung.

## 1. Plattformrolle

- Produktname: Fishing-Club-Portal
- Produkttyp: vereinsunabhaengige Multi-Tenant-Softwareplattform fuer Vereine
- Technischer Plattformbetreiber: Michael Lauenroth
- Plattform ist nicht auf einen einzelnen Verein beschraenkt
- Vereine sind Mandanten der Plattform

## 2. Architektur

- Frontend: Astro-basierte Webanwendung
- Authentifizierung und Datenbank: Supabase
- Hosting der Website/Plattform: IONOS
- Daten mehrerer Vereine werden technisch getrennt verarbeitet
- Mandantenbezug erfolgt ueber Club-/Tenant-Logik in Datenmodell und Berechtigungen

## 3. Rollenmodell

- Plattformbetreiber: technische Plattform, Betrieb, Sicherheit, Softwarepflege
- Jeweiliger Verein: Verantwortlicher fuer Vereinsinhalte, Vereinsdaten, Mitgliederdaten und lokale Ansprechpartner
- Vereinsrollen im Portal: Mitglied, Vorstand, Admin, Superadmin/Plattformrolle

## 4. Authentifizierung und Session

- Technischer Login-Identifier ist die im Auth-System gefuehrte E-Mail-Adresse
- Vereinsinterne Kennungen wie Mitgliedsnummer oder Kuerzel koennen fuer Anzeige und Zuordnung genutzt werden
- Session-Informationen werden aktuell teilweise im `localStorage` verarbeitet
- Rollen- und Zugriffspruefungen werden zusaetzlich server- und datenbankseitig abgesichert

## 5. Datenkategorien

- Stammdaten
- Kommunikationsdaten
- Portalnutzungsdaten
- vereinsbezogene Fachdaten
- technische Verbindungs- und Sicherheitsdaten
- optional Zahlungs-/SEPA-Daten im Mitgliedsantragsprozess

## 6. Sicherheitsmassnahmen

- TLS/HTTPS
- rollenbasierte Zugriffskontrolle
- mandantenbezogene Daten- und Zugriffslogik
- CSP und Security Header im Web-Layer
- technische Sicherheitsprotokollierung
- RLS-/RPC-Haertung in Supabase

## 7. Externe Dienste

Je nach aktivierter Funktion werden derzeit insbesondere folgende externe Quellen eingebunden:

- Supabase fuer Authentifizierung und Datenbank
- Cloudflare Turnstile fuer Bot-Schutz
- Google Maps Embed
- Leaflet CDN (`unpkg.com`)
- OpenStreetMap-Kacheln
- Rainviewer / Open-Meteo
- externer QR-Code-Dienst `api.qrserver.com`
- externer Shop-Client fuer Shop-Seiten

## 8. Datenschutzlogik

- Plattformseitige technische Verarbeitung ist von mandantenspezifischer Vereinsverarbeitung zu trennen
- Vereinsspezifische Ansprechpartner, Impressumsdaten und Ergaenzungstexte sollen mandantenspezifisch gepflegt werden
- Plattformtexte sollen neutral formuliert sein und keinen einzelnen Verein hart codieren

## 9. Offene juristische Punkte

- finale Rollenbeschreibung Plattformbetreiber vs. Verein
- AVV-/DPA-Struktur fuer Mandantenbetrieb
- finale Impressums- und Ansprechpartnerlogik je Mandant
- finale Retention-/Loeschfristen je Datenkategorie
- mittelfristige Bewertung von `localStorage` vs. HttpOnly-Cookie-Session
