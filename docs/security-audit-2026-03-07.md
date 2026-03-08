# Security & Consistency Audit (2026-03-07)

## Scope
- Project-wide scan for:
`contradictions/overwrites`, `event listener handling`, `XSS surfaces`, `DSGVO/privacy handling`, `auth/security robustness`.
- Verified with:
`npm run build` and `npm run test` (both green).

## Executive Summary
- High-impact runtime inconsistencies were found and fixed in app-critical cockpit modules.
- The recurring `{"detail":"Bad Request"}` issue was mitigated by hardening `rpc_touch_user` handling.
- Main residual risk remains broad `innerHTML` usage across modules (mostly escaped, but pattern remains high attention).

## Fixed Findings

### 1) Invalid trailing code / contradiction in member work module
- Finding:
Trailing statements existed after IIFE closure in member work module, causing structural inconsistency and potential runtime side effects.
- Fix:
Moved view/filter initialization into `init()` and removed trailing orphan code.
- File:
[work-events-member.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/work-events-member.js#L521)

### 2) Duplicate listener risk in work cockpit
- Finding:
`init()` is triggered by both `DOMContentLoaded` and `vdan:session`, while listeners were bound inside `init()` without single-bind protection.
- Fix:
Added `listenersBound` and `initInProgress` guards.
- File:
[work-events-cockpit.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/work-events-cockpit.js#L8)
[work-events-cockpit.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/work-events-cockpit.js#L1035)

### 3) Duplicate listener risk in term cockpit
- Finding:
Same init/bind pattern as above.
- Fix:
Added `listenersBound` and `initInProgress` guards.
- File:
[term-events-cockpit.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/term-events-cockpit.js#L6)
[term-events-cockpit.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/term-events-cockpit.js#L321)

### 4) Init race hardening in feed module
- Finding:
Potential concurrent `init()` runs from session events.
- Fix:
Added `initInProgress` guard.
- File:
[home-feed.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/home-feed.js#L24)
[home-feed.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/home-feed.js#L1512)

### 5) Error observability hardening (`detail` support)
- Finding:
Some API errors ignored backend `detail` field.
- Fix:
Error extraction extended to include `err.detail` in key modules.
- Files:
[home-feed.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/home-feed.js#L82)
[work-events-cockpit.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/work-events-cockpit.js#L38)
[term-events-cockpit.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/term-events-cockpit.js#L30)
[documents-admin.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/documents-admin.js#L170)
[portal-quick.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/portal-quick.js#L223)
[catchlist.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/catchlist.js#L486)

### 6) `rpc_touch_user` bad-request noise mitigation
- Finding:
Presence RPC failures could repeatedly fire and pollute runtime.
- Fix:
Disable touch RPC on `400/401/403/404` (not only `404`).
- Files:
[ui-session.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/ui-session.js#L32)
[ui-session.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/ui-session.js#L93)
[catchlist.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/catchlist.js#L97)
[catchlist.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/catchlist.js#L701)

### 7) XSS hardening in documents table config rendering
- Finding:
Column metadata rendering relied on template injection; low risk (config-backed), but unescaped in some attributes/text.
- Fix:
Escaped column labels/keys before insertion.
- File:
[documents-admin.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/documents-admin.js#L332)

## DSGVO / Privacy Check

### Implemented
- Consent manager present and wired (`vdan:consent-changed`), with external-media gating.
- Legal pages and consent settings links present in layout/footer.
- External embeds use consent-aware placeholders.

### Risk Notes
- Auth/session data and feature/UI preferences are stored in `localStorage`/`sessionStorage`.
- This is common in SPA setups but increases XSS impact because tokens are script-accessible.

## XSS Review (Current Risk)

### Positive
- Most user-facing dynamic templates use escaping helpers (`esc`, `escapeHtml`).

### Residual Risk
- Project has many `innerHTML`/`insertAdjacentHTML` call sites across modules.
- Even with current escapes, this pattern is error-prone for future changes.

## Open Issues (Prioritized)

### P0
1. Introduce one shared safe render helper (`setText`, `attrSafe`, `htmlEsc`) and migrate highest-risk modules first:
`home-feed`, `work-events-*`, `members-admin`, `catchlist-*`.
2. Add lint/test rule to block unescaped `innerHTML` interpolations.

### P1
1. Standardize one-time UI binding pattern across all modules with dual init triggers:
`DOMContentLoaded + vdan:session`.
2. Add centralized event binding helper (`bindOnce(el, event, key, handler)`).

### P2
1. Move session token handling toward HttpOnly cookie / server session (if architecture allows).
2. Add privacy retention policy for local offline caches and per-user cleanup cadence.

## Contradictions / Overwrites Check
- No destructive file overwrite conflict detected during this pass.
- One concrete contradiction (orphan code after IIFE) fixed in `work-events-member.js`.
- Remaining inconsistency class is architectural: repeated local event-binding patterns across modules.

## Verification
- `npm run build`: pass
- `npm run test`: pass (28/28)

## Recommended Next Sprint (Concrete)
1. Add global `bindOnce` utility and migrate 5 highest-traffic modules.
2. Add test that fails on unsafe `innerHTML` interpolation patterns.
3. Add security regression checklist to PR template (XSS, consent, auth headers, role gate).
