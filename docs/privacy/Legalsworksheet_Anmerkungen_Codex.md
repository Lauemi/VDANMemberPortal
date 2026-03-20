# Anmerkungen Zu `Legalsworksheet.md`

Stand: 2026-03-19

## Kurzfazit

Die Arbeitsdatei ist als juristische Rohfassung gut strukturiert, aber an mehreren Stellen noch bewusst generisch. Fuer dieses Repo laesst sich technisch bereits jetzt relativ klar einordnen, welche Punkte aktuell wirklich eingesetzt werden und welche Abschnitte eher als Vorsorge fuer spaetere Erweiterungen dienen.

## Was Der Code Aktuell Hergibt

### 1. Analytics

Im aktuellen Repo wurden keine klassischen Web-Analytics-Tools gefunden.

Nicht gefunden wurden insbesondere:

- Google Analytics / `gtag`
- Matomo
- Plausible
- Umami
- PostHog
- vergleichbare Tracking-Skripte

Bewertung:

- In der Datenschutzerklaerung sollte deshalb nicht der Eindruck entstehen, dass Analytics bereits aktiv ist.
- Der Abschnitt zu Cookies/Tracking kann bleiben, sollte aber klar zwischen "derzeit nicht eingesetzt" und "bei spaeterer Einfuehrung nur nach Einwilligung" unterscheiden.

### 2. Push

Push ist technisch vorhanden und aktiv vorbereitet.

Belege:

- Service Worker mit `push`- und `notificationclick`-Handler: `public/sw.js`
- Registrierung des Service Workers: `public/js/pwa-register.js`
- Push-Subscription-Verwaltung: `public/js/app-settings.js`
- DB-Struktur fuer Push-Subscriptions: `docs/supabase/46_push_subscriptions.sql`

Bewertung:

- Push sollte in den Rechtstexten nicht nur als moegliche Zukunftsfunktion erwaehnt werden.
- Hier braucht ihr einen konkreten Abschnitt zu Web-Push-Benachrichtigungen:
  Zweck, Rechtsgrundlage, Opt-in, Widerruf/Abmeldung, gespeicherte Subscription-Daten, ggf. beteiligte Push-Infrastruktur des Browsers.

### 3. Externe Medien

Externe Medien sind vorhanden und consent-gesteuert.

Belege:

- Consent-Manager mit Kategorie `external_media`: `public/js/consent-manager.js`
- Google-Maps-Embed mit Consent-Gating: `src/pages/anglerheim-ottenheim.html.astro`
- Spreadshirt-Shop mit Consent-Gating: `public/js/spreadshirt-shop.js`

Bewertung:

- Der Datenschutztext sollte externe Medien nicht nur abstrakt nennen.
- Google Maps Embed und Spreadshirt/Shop-Integration sollten konkret benannt werden.
- Gut ist, dass bereits ein Consent-Mechanismus vorhanden ist.

### 4. Karten

Karten kommen in zwei Formen vor:

- Google Maps Embed auf der Anglerheim-Seite
- Leaflet-Karte mit externer CDN-Nachladung in `public/js/member-water-map.js`

Bewertung:

- Das ist datenschutzrechtlich relevant.
- Fuer Leaflet ueber `unpkg.com` besteht ein externer Abruf von Drittinhalten.
- Fuer Google Maps ist die Drittland-/Google-Thematik noch sensibler.
- In der Datenschutzerklaerung sollten diese Karten nicht nur unter "externe Medien" versteckt bleiben, sondern mindestens als Unterpunkt klar benannt werden.

### 5. Newsletter

Es wurden im aktuellen Repo keine Hinweise auf Newsletter-Versand, Newsletter-Anmeldung oder Newsletter-Dienstleister gefunden.

Nicht gefunden:

- Mailchimp
- Brevo / Sendinblue
- CleverReach
- Newsletter-Formulare oder Versandlogik

Bewertung:

- Newsletter sollte im aktuellen Rechtsstand als "derzeit nicht eingesetzt" dokumentiert werden.

### 6. Externe Log-/Monitoringdienste

Es wurden keine klassischen externen Monitoring- oder Error-Tracking-Dienste gefunden.

Nicht gefunden:

- Sentry
- Bugsnag
- LogRocket
- Rollbar
- vergleichbare Client- oder Server-Monitoring-Skripte

Was aber sehr wahrscheinlich trotzdem existiert:

- Hosting-/Server-Logs
- Supabase-seitige Plattform- und Infrastruktur-Logs
- technische Sicherheits- und Fehlerprotokolle innerhalb der Plattformlogik

Bewertung:

- Wenn keine externen Monitoringdienste eingebunden sind, sollte der Text das auch so sagen.
- Gleichzeitig solltet ihr "technische Protokolldaten / Sicherheitslogs / Hosting-Logs" sauber beschreiben.

## Welche Analytics Hier Sinnvoll Waeren

Wenn ihr Analytics spaeter einfuehrt, wuerde ich fuer dieses Produkt keine marketinglastige Vollverfolgung empfehlen, sondern datensparsame Produkt- und Conversion-Analytics.

Sinnvolle Fragen fuer dieses System:

- Wie viele Vereine starten den Registrierungsprozess?
- Wo brechen Vereine oder Nutzer im Onboarding ab?
- Welche oeffentlichen Seiten werden wirklich genutzt?
- Welche Module im Portal werden aktiv verwendet?
- Wo gibt es UX-Probleme bei Login, Invite, Eventplanung, Dokumenten und Mitgliederzugang?

### Empfehlenswerte Richtung

Wenn ihr Analytics einbaut, dann eher:

- Plausible oder Matomo
- moeglichst cookielos bzw. datensparsam
- nur fuer oeffentliche Seiten zuerst
- Portal-/Mitgliedsbereich nur sehr zurueckhaltend und gut begruendet

### Was Ich Nicht Empfehle

- Vollstaendige Nutzerverhaltens-Profile
- uebermaessiges Event-Tracking im Mitgliederbereich
- Session-Replay-Tools ohne sehr gute rechtliche und technische Begruendung

### Konkrete Empfehlung

Fuer euch waere wahrscheinlich ein zweistufiges Modell sinnvoll:

1. Oeffentliche Website:
   datensparsame Reichweitenmessung und Conversion-Messung
2. Portal:
   nur technische Produktmetriken und anonyme Nutzungsereignisse, falls ueberhaupt

## Indexing / Google / Sitemap

### Was Gut Ist

Das Projekt hat bereits mehrere gute SEO-/Indexing-Bausteine:

- Sitemap-Integration via Astro: `astro.config.mjs`
- erzeugte Dateien in `dist`: `dist/sitemap-index.xml`, `dist/sitemap-0.xml`
- Canonical-Link im globalen Layout: `src/layouts/Site.astro`
- `robots`-Meta-Tag im globalen Layout: `src/layouts/Site.astro`
- strukturierte Daten via JSON-LD (`schema.org`) im Layout: `src/layouts/Site.astro`

### Was Noch Fehlt Oder Geprueft Werden Sollte

Im Build wurde kein `robots.txt` gefunden.

Bewertung:

- Sitemap ist vorhanden und grundsaetzlich gut.
- Canonical und strukturierte Daten sind ebenfalls vorhanden.
- Fuer Google fehlt sehr wahrscheinlich noch eine explizite `robots.txt` mit Verweis auf die Sitemap.

Empfehlung:

- `public/robots.txt` anlegen
- dort mindestens:
  - `User-agent: *`
  - `Allow: /`
  - `Sitemap: https://www.vdan-ottenheim.com/sitemap-index.xml`

### Wichtiger Hinweis Zum Domain-Setup

In `astro.config.mjs` ist aktuell als `site` noch `https://www.vdan-ottenheim.com` eingetragen, mit Kommentar `TODO: set your domain`.

Wenn das Produkt unter einer anderen Hauptdomain oder parallel unter `fishing-club-portal.de` laufen soll, dann ist das fuer Sitemap, Canonical und Google-Indexierung kritisch und sollte sauber vereinheitlicht werden.

## Konkrete Text-Empfehlungen Fuer Die Worksheet-Datei

Die Passage

- Analytics
- Push
- externe Medien
- Karten
- Newsletter
- externe Log-/Monitoringdienste

sollte in der Legal-Arbeitsfassung nicht offen stehenbleiben, sondern so beantwortet werden:

- Analytics: derzeit nicht im Repo nachweisbar aktiv
- Push: ja, technisch vorhanden und in App/Service-Worker vorgesehen
- Externe Medien: ja, Consent-gesteuert
- Karten: ja, Google Maps Embed und Leaflet/CDN
- Newsletter: derzeit nicht nachweisbar aktiv
- Externe Log-/Monitoringdienste: keine klassischen Dritttools gefunden, aber technische Hosting-/Sicherheitslogs plausibel

## Prioritaeten Aus Rechtssicht

Die wichtigsten offenen Nacharbeiten waeren aus meiner Sicht:

1. Push sauber in Datenschutztext aufnehmen
2. Karten / externe Medien konkret benennen
3. klare Aussage "derzeit kein Analytics / kein Newsletter", falls das so bleiben soll
4. Rollenmodell Plattformbetreiber vs. Verein rechtlich sauber schaerfen
5. `robots.txt` ergaenzen und Domain-/Canonical-Setup final pruefen
