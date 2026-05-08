## Smoke-Test-Report 2026-05-08 [MINAAA-16]

**Route:** API `POST /functions/v1/club-invite-claim` + Post-State via `rpc:get_onboarding_process_state`
**Testdaten:** VDAN, separater Test-Invite-Token (nicht `7594157f...`), Test-User `fcp_demo1@fishing-club-portal.de`, Test-Mitglied `member_no 529` (status `Aktiv`)
**Erwartetes Verhalten:** Invite-Claim erfolgreich; `invite_state=ACTIVE`, `membership_state=ACTIVE`, `requirements.profile_complete=true`, `process.status=completed`
**Tatsächliches Verhalten:** Alle Validierungen grün laut API-Smoke-Artefakt; Claim und Post-State entsprechen Soll.
**Ergebnis:** PASS
**Artefakt:** `docs/Smoke-Tests/invite-claim-flow/results/MINAAA-16_2026-05-08_PASS.md`, Commit `42e763d`; zusätzlich Script `docs/smoke-tests/SMOKE1_invite_claim.sh`
**Blocker-Typ:** Fachlicher Fehler: keiner (zuvor Environment-Blocker in separatem Vorlaufreport)
**Nächster Schritt:** MINAAA-16 formal schließen; Setup-Check „SSH-Remote standardmäßig prüfen“ als Workspace-Onboarding-Hinweis führen.
