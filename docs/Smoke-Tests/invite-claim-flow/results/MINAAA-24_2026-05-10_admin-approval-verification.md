# Verifikation: MINAAA-24 Admin-Approval-Pfad (Launch-Blocker)
_Datum: 2026-05-10 (UTC)_
_Ausgeführt: FCP-Technical (Repo-verifiziert)_

## Ergebnis: 🟢 PASS (Repo-Stand)

## Scope
- Admin-Freigabeentscheidung: `supabase/functions/club-request-decision/index.ts`
- Setup-Nachlauf nach Freigabe: `supabase/functions/club-admin-setup/index.ts`
- Regressionstest (statisch, code-nah): `tests/admin-approval-path-regression.test.js`

## Prüfpunkte

| Check | Erwartet | Ergebnis |
|---|---|---|
| Actor-Gate vor Decision | Nur Admin darf approve/reject | ✅ `isAdmin(...)` + `forbidden_admin_only` vorhanden |
| Request-State-Gate | Entscheidung nur bei `status = pending` | ✅ `request_not_pending`-Guard vorhanden |
| Approve-Pfad | Freigabe triggert `club-admin-setup` | ✅ POST auf `/functions/v1/club-admin-setup` vorhanden |
| Persistenz Freigabe | Status + Approval-Metadaten werden geschrieben | ✅ `status: approved`, `approved_club_id`, `approved_by`, `approved_at`, `decision_payload.action=approve` |
| Setup-Gate | Setup nur Admin ODER eigener bereits approved Request | ✅ `actorIsAdmin || approvedOwnRequest` Gate vorhanden |

## Ausgeführte Verifikation

Command:
```bash
npm run -s test -- tests/admin-approval-path-regression.test.js tests/onboarding-security-regressions.test.js
```

Ergebnis:
- `admin-approval-path-regression.test.js`: PASS
- `onboarding-security-regressions.test.js`: PASS
- Gesamtlauf: 6/6 Tests PASS

## Bewertung
- Repo-wahr ist der Admin-Approval-Pfad aktuell als Launch-Blocker technisch abgesichert und nachweisbar vorhanden.
- Offener Punkt außerhalb dieses Nachweises: Live-Environment-Ende-zu-Ende-Freigabe (mit realem Request-Datensatz) ist separat als Runtime-Smoke zu fahren, falls Board eine produktive Laufzeitbestätigung verlangt.

## Nächster Schritt
- FCP-COO kann `MINAAA-24` mit dieser Repo-Evidenz schließen oder optional einen zusätzlichen Live-Smoke beauftragen.
