# ENV Matrix

Stand: 2026-03-02
Purpose: single operational source for domain, channel, backend target, and auth/cors settings.

## 1) Transition mode (current)
- `main` serves PROD (VDAN live)
- `prep_vercel_multienv_admin_tools` serves FCP preparation
- Single Supabase project shared until paid split is possible
- Rule: no schema-breaking test in transition mode without restore plan

## 2) Environment matrix

| Environment | Branch | Domain | Vercel target | PUBLIC_APP_CHANNEL | Supabase project ref | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| staging | `develop` | `staging.fishing-club-portal.de` | Preview | `staging` | `REPLACE_ME` | password protected preview |
| beta | `beta` | `beta.fishing-club-portal.de` | Preview | `beta` | `REPLACE_ME` | acceptance checks |
| prod | `main` | `fishing-club-portal.de` | Production | `prod` | `REPLACE_ME` | live traffic |

## 3) Redirect/Auth/CORS checklist per env

| Item | staging | beta | prod |
| --- | --- | --- | --- |
| Supabase Site URL | [ ] | [ ] | [ ] |
| Supabase Redirect URLs | [ ] | [ ] | [ ] |
| Auth reset redirect tested | [ ] | [ ] | [ ] |
| CORS allowlist updated | [ ] | [ ] | [ ] |
| CSP connect-src updated | [ ] | [ ] | [ ] |
| Push callback/endpoint tested | [ ] | [ ] | [ ] |

## 4) Domain strategy (board summary)
1. Keep VDAN stable on current PROD while FCP builds in parallel.
2. Build and validate FCP on staging/beta domains first.
3. Move apex domain to FCP production only after smoke tests are green.
4. VDAN domain redirect is the final step only after multi-club routing is proven.

