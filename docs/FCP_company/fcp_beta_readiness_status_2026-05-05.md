# FCP Beta-Readiness — Board-Sync 2026-05-05

_Erstellt durch FCP-COO nach PR #22 Merge. Repo-wahrer Stand: `main@bb0dea0`_

---

## Repo-wahrer Fixpunkt

| Artefakt | Wert |
|---|---|
| Letzter Sync | 2026-04-26 (nach PR #13) |
| PR #13 | MINA-97 Invite dual-path — **merged** `f47e205` |
| PR #22 | MINA-179 Pfad C existing-email-guidance — **merged** `bb0dea0` (2026-04-29) |
| Aktueller HEAD | `bb0dea0` |

---

## Delta seit Board-Sync 2026-04-26

### PR #22 — MINA-179: Pfad C existing-email-guidance (repo-wahr ✓)

**Was wurde geliefert:**
- `public/js/member-auth.js`: `isInviteSignupExistingEmailError()` + `renderInviteSignupExistingEmailGuidance()` neu
- `public/js/member-auth.js`: Handler im registerForm-Submit bei "email already registered" → Nutzer zu Pfad A leiten mit Link
- `src/pages/vereinssignin.astro`: `data-login-href` Attribut am `registerForm` für korrekte Redirect-URL
- Kein Scope-Creep: Registry-Admin-Change wurde explizit rückgängig gemacht (`534fe04`)

**Invite-Flow-Gesamtstatus:**
| Pfad | Status |
|---|---|
| Pfad A (Login-first) | repo-wahr ✓ |
| Pfad B (Register mit Token) | repo-wahr ✓ |
| Pfad C (existing-email → Login-Guidance) | repo-wahr ✓ (neu seit PR #22) |

---

## Aktuelle Beta-Blocker — Repo-wahre Prüfung (2026-05-05)

### KRITISCH — Beta-Start nicht möglich ohne Lösung

**1. Stripe Billing Live-Test (sc-bill-1)**
- `fcp-create-checkout-session` Edge Function deployed (v8, aktiv)
- DB-Layer bewiesen (INSERT club_billing_webhook_events, UPSERT billing_state=active)
- **Offen:** Live User-Checkout-Session nicht ausgeführt → kein repo-wahrer Beweis
- **Offen:** `STRIPE_WEBHOOK_SECRET` — Existenz nicht eindeutig pruefbar (401 bei falscher Signatur)
- **Wartet auf:** Michael (live Checkout + Secret-Bestätigung)

**2. Onboarding-Gesamtfluss nicht eingefroren (b-on-1)**
- CSV-Import smoke-getestet (sc-on-4 ✓)
- Join/Claim/CSV End-to-End-Strecke als Gesamtfluss: nicht eingefroren
- Leere-State nach erstem Import: nicht gelöst (b-on-2)
- `checked_access: false` auf allen Onboarding-Screens
- **Wartet auf:** Michael (Gesamtpfad Freigabe + Access-Check)

**3. Mitgliederverwaltung — Fachliche Entkopplung (b-mem-1, b-mem-2)**
- `club_members` vs `members` nicht sauber entkoppelt (b-mem-1, severity: hoch)
- Importierte Mitglieder ohne `user_id` passen nicht sauber in Rollenpfad (b-mem-2, severity: hoch)
- Rollenanzeige nicht konsistent geprüft (sc-mem-3 = false)
- Stammsatz/Snapshot fachlich nicht geklärt (sc-mem-4 = false)
- **Wartet auf:** Fachliche Entscheidung (Michael) + Technische Umsetzung

---

### HOCH — Vor Beta-Start klären

**4. Karten / Preismodell — UI-Verbindung offen (b-card-2)**
- `pricing_rules` Tabelle vorhanden (product_id, rule_key, amount_gross, etc.)
- `product_id` FK-Herkunft unklar (kein `products`-Table sichtbar)
- Kein Admin-UI für Kartentypen / Preisregeln
- Pricing Rules Inline Table: Status "offen"
- **Risiko:** Beta-Vereinsadmins können keine Beiträge konfigurieren

**5. Gewässer — Uniqueness Multi-Club (b-water-1)**
- `water_bodies` uniqueness für CSV/Multi-Club-MVP nicht final
- sc-water-2 und sc-water-3 nicht erfüllt
- **Risiko:** Bei Multi-Verein-Nutzung Datenkollisionen möglich

**6. Supabase Redirect Whitelist (GAP)**
- `GAP[supabase-redirect-whitelist]` in `public/js/member-auth.js:1458`
- Auth-Redirect-URL muss in Supabase-Dashboard eingetragen sein
- Status nicht verifiziert
- **Risiko:** Invite-Confirm-Flow könnte in Produktion scheitern

---

### OFFEN — Wartet auf Michael (aus letztem Board-Sync, unverändert)

- Impressum §5 TMG Pflichtdaten liefern
- Datenschutz-Review freigeben
- Beta-Starttermin und Beta-Scope festlegen

---

## Nicht mehr Blocker (seit letztem Sync)

| Punkt | Erledigt durch |
|---|---|
| Invite Pfad A/B gebrochen (MINA-97) | PR #13 merged 2026-04-26 |
| Pfad C existing-email (MINA-179) | PR #22 merged 2026-04-29 |
| acl_stub-Struktur | Nicht mehr vorhanden; produktive RBAC mit seeded Defaults aktiv |
| CSV Golden Path | smoke-getestet (sc-on-4 = true, Stand 2026-04-20) |
| Billing DB-Layer | INSERT + UPSERT bewiesen (Stand 2026-04-20) |
| Settings banking_profile 400 | Fixed (4d64b1b) |

---

## Beta-Readiness Gesamturteil

**NICHT Beta-ready — 3 kritische Blocker offen**

| Bereich | Status | Beta-Blocker? |
|---|---|---|
| Invite-Flow (A/B/C) | **repo-wahr ✓** (alle 3 Pfade) | **NEIN — erledigt** |
| Auth-Flow | **repo-wahr ✓** | nein |
| Legal-Dokumente (Seiten) | **repo-wahr ✓** | Pflichtdaten Michael ausstehend |
| Edge Functions | **repo-wahr ✓** (22 Functions) | nein |
| RLS/ACL | **repo-wahr ✓** (produktive RBAC, kein acl_stub) | nein |
| Billing Live-Test | **nicht CI-verifiziert** | **JA — wartet auf Michael** |
| Onboarding-Gesamtfluss | **teilweise** (CSV ok, Gesamtpfad offen) | **JA** |
| Mitgliederverwaltung Entkopplung | **teilweise** (hoch, 2 Bugs offen) | **JA** |
| Karten/Preismodell | **teilweise** (DB ok, UI fehlt) | möglicherweise |
| Gewässer Uniqueness | **teilweise** | bei Multi-Verein |
| Supabase Redirect Whitelist | **nicht verifiziert** | möglicherweise |

---

## Nächste Schritte

1. **Michael (sofort):** Stripe live Checkout-Session testen + STRIPE_WEBHOOK_SECRET bestätigen
2. **Michael (sofort):** Impressum + Datenschutz Pflichtdaten liefern
3. **Michael + FCP-Technical:** Mitgliederverwaltung Entkopplung (club_members vs members) — fachliche Entscheidung vor Umsetzung
4. **FCP-Technical:** Supabase Redirect Whitelist prüfen und dokumentieren
5. **Michael:** Beta-Scope festlegen — welche Features müssen für Beta-Start stehen?
6. **FCP-SmokeTest:** Nach Michael-Freigaben → Invite-Flow E2E-Smoke auf Staging

