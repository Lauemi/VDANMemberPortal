# Sitzungsnotiz Runtime / Branding / Projektstand

Stand: 2026-03-22

## Ziel der Sitzung

Klarer Gesamtstand zu:

- VDAN/FCP-Trennung
- DB-gesteuerter Runtime- und Branding-Schicht
- Live-Deploy-Risiken
- noch offenen Betriebs- und Entscheidungsfragen

## Projektgesamtstand

Die technische Grundlage fuer eine saubere Trennung zwischen `VDAN` und `FCP` ist aufgebaut und dokumentiert. Die neue Runtime-Schicht fuer Branding und Maskensteuerung ist in Datenbank, Edge-Function und Frontend vorbereitet. Die Architekturphase fuer diesen Block ist weitgehend abgeschlossen.

Der aktuelle Engpass liegt nicht mehr in der Datenbankstruktur oder im Grunddesign, sondern in der vollstaendigen Live-Bestaetigung der Runtime-Kette:

- Edge Function live erreichbar
- Speichervorgang aus dem Adminboard
- Nachweis in Config-, Audit- und Release-Tabellen

## Erledigt

- harte Guard-Trennung fuer statische VDAN-/FCP-Seiten im Code
- zentrale Static-Web-Matrix fuer Sichtbarkeit und Brand
- Runtime-Foundation in der DB aufgebaut
- kanonischer Route-Katalog angelegt
- Default-Seeds fuer `branding.static_web_matrix` und `branding.app_mask_matrix` eingespielt
- atomarer Publish-RPC fuer Runtime-Configs gebaut
- Audit- und Release-Log-Grundlage angelegt
- Audit `109` fuer Runtime-Foundation gruen
- Audit `110` fuer atomaren Publish gruen
- Deploy-Gate fuer FCP/VDAN-Trennung und Runtime-Bereich angelegt
- Remote-Smoke-Skript fuer Functions angelegt
- `admin-web-config` als Runtime-Schicht gebaut
- oeffentlicher Runtime-Read auf `GET` umgestellt, um Preflight-Probleme zu reduzieren
- CSP-Blocker im gemeinsamen Layout beseitigt
- VDAN-Header ohne Header-Login-Entry umgesetzt
- Favicon-Pfade fuer VDAN auf vorhandene Assets korrigiert

## Noch offen

- echter End-to-End-Nachweis in der Zielumgebung
- Nachweis, dass Save aus dem Adminboard korrekt schreibt in:
  - `app_runtime_configs`
  - `app_runtime_audit_log`
  - `app_runtime_releases`
- Deploy und Bestaetigung weiterer betroffener Functions:
  - `club-admin-setup`
  - `club-onboarding-workspace`
- abschliessender Remote-Smoke nach allen relevanten Function-Deploys
- fachliche Entscheidung, welche Masken standardmaessig `fcp_brand` vs. `fcp_tactical` sein sollen

## Was dem Board gemeldet werden sollte

Die neue Runtime- und Branding-Schicht ist technisch aufgebaut, auditiert und deploy-vorbereitet. Die SQL-/Architekturbasis ist abnahmefaehig. Der verbleibende operative Pruefpunkt ist die produktive Runtime-Kette:

- Function-Deploy
- echter Save aus dem Adminboard
- Nachweis in Config-, Audit- und Release-Tabelle

Empfohlene Board-Formulierung:

> Die Runtime- und Branding-Schicht fuer VDAN/FCP ist technisch implementiert, auditiert und kontrolliert deployfaehig. Der verbleibende Pruefpunkt ist die produktive End-to-End-Wirksamkeit der Runtime-Kette inklusive Function-Deploy, Speichervorgang und Audit-/Release-Nachweis.

## Wo Feedback von CTO / CXO / CEO gebraucht wird

### CTO

- Soll `admin-web-config` dauerhaft oeffentlich lesbar fuer `GET` bleiben?
- Was ist der naechste technische Ausbau:
  - `module_visibility`
  - `theme_tokens`
  - Template-Bindings
- Soll die statische Runtime-Ausblendung spaeter serverseitig weiter verstaerkt werden oder bewusst nur Komfort-/Runtime-Ebene bleiben?

### CXO

- Welche App-Masken sollen klar `fcp_tactical` sein?
- Welche App-Masken oder oeffentlichen Flaechen sollen bewusst `fcp_brand` bleiben?
- Welche VDAN-Ausnahmen muessen langfristig unangetastet bleiben?

### CEO

- Welche Aussenwirkung ist strategisch gewollt:
  - FCP global markenstark und innen taktisch
  - oder FCP global eher operativ und nur aussen markig
- Welche Oberflaechen muessen kurzfristig demo-, vertriebs- oder rolloutfaehig sein?
- Welche Themen sind in den naechsten Wochen wichtiger:
  - Runtime-Steuerung fertigziehen
  - Vereinsanlage / Onboarding haerten
  - Produktflaechen und Demos

## Welche Informationen vom Projektinhaber besonders hilfreich waeren

- klare Liste:
  - welche Seiten sind dauerhaft `VDAN-only`
  - welche Seiten sind dauerhaft `FCP-only`
  - welche Seiten sind `shared`
- klare Entscheidung:
  - welche Masken sollen standardmaessig `fcp_brand`
  - welche Masken sollen standardmaessig `fcp_tactical`
- klare Prioritaet fuer die naechste Ausbaustufe:
  - Live-Runtime-Kette final abnehmen
  - Vereinsanlage voll absichern
  - `module_visibility`
  - `theme_tokens`
  - Template-/JSON-System
- klares Betriebsbild:
  - wer darf spaeter Runtime-Aenderungen im Adminboard wirklich speichern
  - nur Superadmin oder mehrere Rollen

## Technischer Status in einem Satz

Die Architektur- und Datenbankbasis ist fuer diesen Block sauber, kontrolliert und auditiert; der naechste echte Abnahmepunkt ist die Live-Bestaetigung der Runtime-Kette auf der Zielumgebung.

