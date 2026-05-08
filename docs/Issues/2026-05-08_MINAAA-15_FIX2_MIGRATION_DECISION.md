# MINAAA-15 — Fix-2 Migration Decision (AKTIV/PASSIV Mapping)

Datum: 2026-05-08  
Ticket: MINAAA-15

## Ist-Stand

Fix 2 wurde in bestehender Migration umgesetzt:
- `supabase/migrations/20260407103200_harden_onboarding_process_state.sql`

Dort ist das Mapping ergänzt:
- `ACTIVE` + `AKTIV` -> `ACTIVE`
- `PASSIVE` + `PASSIV` -> `PASSIVE`

## Bewertung

Das Runtime-Verhalten ist im Repo korrekt abgebildet.

Formal bleibt ein Migrations-Hygiene-Thema offen, weil eine bereits bestehende Migration editiert wurde statt eine additive Follow-up-Migration anzulegen.

## Entscheidung für Phase 1

Phase 1 wird als **fachlich umgesetzt** geführt, mit offenem **Migration-Debt**.

## Nächste Aktion (Owner)

Owner: COO/DB-Governance  
Aktion: Entscheiden, ob für Historien-Hygiene eine additive Nachziehmigration erstellt werden soll (z. B. `CREATE OR REPLACE public.get_onboarding_process_state` als Follow-up).

