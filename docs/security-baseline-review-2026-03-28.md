# Security Baseline Review
Stand: 2026-03-28

Hinweis:
Diese Pruefung ist eine technische Repo- und Laufzeitpfad-Sichtung. Sie ersetzt keine anwaltliche DSGVO-Pruefung, keine Live-Penetration-Tests und keine Hosting-Auditierung.

## Zweck
Diese Datei aktualisiert den Security-/Legal-Baseline-Stand auf Basis des aktuellen Repos.

Sie korrigiert insbesondere aeltere Befunde, die inzwischen teilweise ueberholt sind.

## Scope
- Web-Sicherheitsheader und CSP
- Session-/Token-Speicherung im Frontend
- Legal- und Acceptance-Basis fuer Nutzungsbedingungen und Datenschutz
- Club-Request-Guard und rechtliche Gates
- bekannte XSS-Restflaechen im Frontend

## Positiv verifiziert

### 1. Zentrale Security-Header-Baseline ist inzwischen vorhanden
Die Middleware [src/middleware.ts](/Users/michaellauenroth/Downloads/vdan-app-template/src/middleware.ts) setzt heute zentral:
- `Content-Security-Policy`
- `Referrer-Policy`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy`
- `Strict-Transport-Security` fuer HTTPS-Hosts ausserhalb localhost

Wichtig:
- der aeltere Befund “keine erkennbare CSP-/Header-Baseline” ist damit im aktuellen Repo-Stand nicht mehr zutreffend

### 2. Rechtstexte fuer FCP sind nicht mehr Platzhalter
Die Seiten
- [nutzungsbedingungen.html.astro](/Users/michaellauenroth/Downloads/vdan-app-template/src/pages/nutzungsbedingungen.html.astro)
- [datenschutz.html.astro](/Users/michaellauenroth/Downloads/vdan-app-template/src/pages/datenschutz.html.astro)

liefern im FCP-Modus heute echte Inhalte aus, keine bloßen Platzhalter.

Damit ist der aeltere Hoch-Befund zu fehlenden FCP-Finaltexten im aktuellen Repo-Stand ueberholt.

### 3. Legal-Acceptance ist technisch in Runtime und DB verankert
Verifizierte Kette:
- SQL-Basis: [20260319143000_legal_documents_and_avv_acceptance.sql](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/migrations/20260319143000_legal_documents_and_avv_acceptance.sql)
- Runtime-Abfrage: [member-auth.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-auth.js)
- Runtime-Accept: [member-auth.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-auth.js), [legal-acceptance.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/legal-acceptance.js)
- UI-Verlinkung im Onboarding:
  - [verein-anfragen.astro](/Users/michaellauenroth/Downloads/vdan-app-template/src/pages/verein-anfragen.astro)
  - [vereinssignin.astro](/Users/michaellauenroth/Downloads/vdan-app-template/src/pages/vereinssignin.astro)

### 4. Club-Request-Pending-Guard ist sichtbar implementiert
Die Sperrlogik fuer noch nicht freigegebene Vereinsanfragen ist aktuell konsistent:
- Gate-RPC in SQL
- Runtime-Nutzung in [member-auth.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-auth.js)
- Guard in [member-guard.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-guard.js)

Damit ist die Sicherheits- und Governance-Logik um `status=pending` im Repo klar erkennbar.

## Aktuelle Findings

### 1. Hoch: Session-Architektur ist verbessert, aber nicht auf HttpOnly-Niveau
Betroffene Stelle:
- [member-auth.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-auth.js)

Bewertung:
- Access-Token-Sessions werden heute primaer in `sessionStorage` gehalten
- alte `localStorage`-Sessions werden migriert
- zusaetzlich bleibt Session-Metadatenzustand in `localStorage`

Das ist besser als der aeltere Stand mit direkter `localStorage`-Session, aber:
- Tokens bleiben weiterhin skriptlesbar
- jede erfolgreiche XSS bleibt deshalb sicherheitsrelevant

Einordnung:
- Risiko reduziert
- nicht erledigt

Empfehlung:
- mittelfristig auf HttpOnly-Cookie-/serverseitige Session umstellen
- bis dahin CSP und DOM-Hygiene weiter priorisieren

### 2. Mittel: `portal-quick.js` nutzt weiterhin HTML-Template-Injektion
Betroffene Stelle:
- [portal-quick.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/portal-quick.js)

Bewertung:
- das frueher benannte Risiko ist im Kern weiterhin da
- im geprueften Abschnitt werden zentrale Werte zwar bereits escaped oder aus konstanten Labels gebaut
- die Renderstrategie basiert aber weiterhin auf `innerHTML`

Einordnung:
- kein unmittelbarer Nachweis einer exploitable Stelle im geprueften Ausschnitt
- aber weiterhin ein fragiler Pattern-Footprint

Empfehlung:
- `portal-quick.js` schrittweise auf DOM-APIs mit `textContent` und `setAttribute` umstellen
- denselben Standard spaeter fuer weitere Hotspots nutzen

### 3. Mittel: Das Repo hat weiterhin einen breiten `innerHTML`-/Template-Footprint
Betroffene Bereiche:
- viele Module unter [public/js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js)

Bewertung:
- das ist kein einzelner Bug, sondern ein Baseline-Thema
- durch vorhandene CSP wird das Gesamtrisiko abgefedert
- trotzdem bleibt es ein relevanter Zukunfts- und Regressionspfad

Empfehlung:
- fuer neue kritische UI-Flows keine neue freie HTML-Injektion einfuehren
- mittelfristig Lint-/Gate-Regel fuer unescaped Interpolation ergaenzen

### 4. Mittel: Operative DSGVO-/Security-Nachweise sind im Repo erkennbar, aber nicht als vollstaendig abgeschlossen belegt
Beispielhafte Hinweise:
- [docs/security-dsgvo-checklist.md](/Users/michaellauenroth/Downloads/vdan-app-template/docs/security-dsgvo-checklist.md)
- [docs/project/DSGVO_DPA_TIA_UMSETZUNG_SUPABASE_IONOS_2026-03-09.md](/Users/michaellauenroth/Downloads/vdan-app-template/docs/project/DSGVO_DPA_TIA_UMSETZUNG_SUPABASE_IONOS_2026-03-09.md)
- [docs/legal/FCP_AVV_Status_2026-03-20.md](/Users/michaellauenroth/Downloads/vdan-app-template/docs/legal/FCP_AVV_Status_2026-03-20.md)

Bewertung:
- viele Bausteine sind dokumentiert
- fuer einen echten Compliance-Nachweis reicht “im Repo vorhanden” allein aber nicht

Empfehlung:
- offene organisatorische Punkte als Release-Gate markieren statt nur als Dokumentenlandschaft

## Status der aelteren Findings vom 2026-03-16

### Frueherer Finding 1: Keine CSP-/Header-Baseline
- aktueller Stand: erledigt im Repo
- Referenz: [middleware.ts](/Users/michaellauenroth/Downloads/vdan-app-template/src/middleware.ts)

### Frueherer Finding 2: Session im `localStorage`
- aktueller Stand: teilweise reduziert
- Session primaer in `sessionStorage`, Metadaten/Fallback weiter lokal
- bleibt offen als Architektur-Restthema

### Frueherer Finding 3: FCP-Rechtstexte nur Platzhalter
- aktueller Stand: erledigt im Repo
- Referenz:
  - [nutzungsbedingungen.html.astro](/Users/michaellauenroth/Downloads/vdan-app-template/src/pages/nutzungsbedingungen.html.astro)
  - [datenschutz.html.astro](/Users/michaellauenroth/Downloads/vdan-app-template/src/pages/datenschutz.html.astro)

### Frueherer Finding 4: `portal-quick.js` als XSS-Flaeche
- aktueller Stand: weiterhin relevant als Pattern-Risiko
- genauer Exploit-Grad haengt von Datenherkunft ab

### Frueherer Finding 5: Operative Baseline nicht als erfuellt nachgewiesen
- aktueller Stand: weiterhin offen

## Recht / Nutzungsbedingungen / Datenschutz Kurzfazit

### Nutzungsbedingungen
- vorhanden
- FCP-spezifische Fassung vorhanden
- im Onboarding verlinkt

### Datenschutz
- vorhanden
- FCP-spezifische Fassung vorhanden
- lokale Speichermechanismen und Infrastruktur sind textlich adressiert

### Legal Acceptance
- technisch verankert
- Runtime-seitig erzwungen

## Empfohlene naechste Reihenfolge
1. `portal-quick.js` und weitere kritische `innerHTML`-Hotspots auf sichere DOM-Erzeugung umstellen.
2. Session-Architektur mittelfristig Richtung HttpOnly-/Server-Session bewegen.
3. Offene Security-/DSGVO-Checklisten in einen echten Freigabestatus ueberfuehren.
4. Den neuen Stand als Referenz verwenden, nicht mehr das Review vom 2026-03-16 allein.

## Pruefgrenzen
Nicht geprueft wurden:
- reale Hosting-Header in Produktion
- Live-CSP-Verhalten auf allen Deployments
- Edge-/Mail-Zustellung in echter Umgebung
- externe Vertrags- und Organisationsnachweise ausserhalb des Repos
