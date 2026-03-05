# Projektstatus One-Pager - VDAN/FCP Plattform

Stand: 4. März 2026  
Zielgruppe: CTO, CXO, CEO, Datenschutzbeauftragter, Zahlungsabwicklung, Vereinsbetrieb, interne Fachabteilungen

## 1) Executive Summary (für CEO/CXO)

- Gesamtstatus: **Gelb-Grün (technisch weit, operativ noch Gate-offen)**
- Architekturumbau auf Multi-Tenant + DSGVO-Baseline ist umgesetzt und dokumentiert.
- Kritische technische Blocker sind aktuell nicht identifiziert.
- Produktions-Go hängt an klar benannten Restprüfungen (Security/Smoke/Consent) und Betriebsaufgaben (Monitoring/Restore/Owner).

Entscheidungslage heute:
- **Kein No-Go aus Architekturgründen**
- **Bedingtes Go**, sobald Release-Gates formell abgehakt sind

## 2) Technischer Status (für CTO)

Abgeschlossen:
- Tenant-Scoping und RLS-Härtung in Main-Linie vorbereitet.
- DSGVO-Baseline vorhanden (`74_security_dsgvo_baseline.sql`).
- DSGVO-Operations-Helper vorhanden (`75_dsgvo_ops_helpers.sql`).
- Tenant-Key-Hardening inkl. Runbook vorhanden:
  - `docs/supabase/76_tenant_key_hardening_safe.sql`
  - `docs/supabase/76_tenant_key_hardening_runbook.md`
- Board-Release-Gate und Audit-Dokument liegen vor.

Wichtig:
- Der frühere CSV/Edge-Import-Ansatz wurde bewusst wieder entfernt (Sicherheits-/Stabilitätsentscheidung).
- Aktueller Arbeitsbranch: `prep_vercel_multienv_admin_tools`.

## 3) Datenschutz- und Compliance-Status (für DSB)

Abgeschlossen:
- Datenschutztext in Audit-Version liegt vor und ist mit technischer Zielarchitektur abgestimmt.
- Rollenmodell, Zugriffstrennung, Protokollierung und technische Schutzmaßnahmen sind dokumentiert.
- Drittland- und AVV-Rahmen sind in den Unterlagen adressiert.

Offen:
- Formale juristische Endfreigabe als letzter Governance-Schritt.
- Laufende Pflege der Dienstleister-/Subprozessoren-Anlage als versionierte Liste.

## 4) Zahlungsabwicklung / SEPA / Vereinsprozesse

Status:
- SEPA/IBAN-Verarbeitung ist in den Prozessen technisch vorgesehen (minimal, rollenbasiert, verschlüsselt in sensiblen Bereichen).
- Kein aktueller Hinweis auf Architekturbruch in Mitgliedsantrag-/Mitgliederprozess.

Offene Betriebsaufgabe:
- Restore-Drill für datenrelevante Prozesse (inkl. Mitglieds-/Zahlungsbezug) terminieren und nachweisen.

## 5) Vereinsbetrieb / Fachabteilungen (nicht-technisch)

Bedeutung für den Betrieb:
- Plattform ist strukturell auf skalierbaren Vereinsbetrieb ausgelegt.
- Öffentliche Inhalte + geschütztes Portal sind in der Zielarchitektur berücksichtigt.
- Der operative Go-Prozess ist transparent über ein einheitliches Gate-Dokument steuerbar.

Was jetzt gebraucht wird:
- Benennung von Ownern und Terminen für die drei Betriebsaufgaben.
- Abzeichnung der Pflicht-Gates vor Produktivfreigabe.

## 6) Offene Pflichtpunkte vor finalem Go

Aus `docs/board-release-gate.md`:
- Security Gate: anon Write-Grants/Policies + RLS-Leak-Test final abhaken.
- Functional Gate: Smoke-Tests für anon/member/admin final abhaken.
- Consent Gate: Einwilligung/Widerruf technisch wirksam nachweisen.
- Betriebsaufgaben mit Owner + Zieldatum befüllen:
  - Monitoring/Alerting
  - Restore-Drill
  - Juristische Endfreigabe Datenschutz

## 7) Risiko- und Entscheidungsbild

Top-Risiko:
- Künftige Features ohne verpflichtenden Tenant-/Policy-Review.

Empfohlene Steuerung:
- Tenant-Policy-Review als Pflichtschritt vor Merge neuer Features.
- Release nur gegen explizites Gate-Häkchen (nicht implizit).

## 8) Empfohlene nächste Entscheidung (Board/GL)

**Empfehlung: Bedingtes Go**

Freigabeformel:
- Go, sobald Security + Functional + Consent Gate vollständig dokumentiert abgehakt sind und Owner/Termine für Betriebsaufgaben gesetzt sind.

---

Referenzdokumente:
- `docs/board-release-gate.md`
- `docs/audit_main_multi_tenant_dsgvo_2026-03-04.md`
- `docs/supabase/74_security_dsgvo_baseline.sql`
- `docs/supabase/75_dsgvo_ops_helpers.sql`
- `docs/supabase/76_tenant_key_hardening_safe.sql`
- `docs/supabase/76_tenant_key_hardening_runbook.md`
- `docs/legal/datenschutzerklaerung_vdan_portal_audit_version_2026-03-04.md`
