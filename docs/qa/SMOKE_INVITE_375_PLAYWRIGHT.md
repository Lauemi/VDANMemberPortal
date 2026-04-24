# Smoke Setup: Invite-Flow @ 375px (Playwright)

## Ziel
Stellt eine reproduzierbare Smoke-Umgebung fuer den mobilen Invite-Flow (`/vereinssignin`) bereit und prueft, dass der Kernpfad bei 375px viewport renderbar und bedienbar bleibt.

## Lokal ausfuehren
1. `npm ci`
2. `npx playwright install chromium`
3. `npm run build`
4. `npm run test:smoke:invite-375`

## Was der Smoke prueft
- Invite-Entry mit Query-Parametern laedt (`invite`, `club_name`, `club_code`).
- Invite-Kontext ist am Formular gesetzt (`data-has-invite-context=true`).
- Invite-Token wird im Feld vorausgefuellt.
- CTA `Konto anlegen` ist sichtbar und nach Mobile-Anchor-Sprung im Viewport.

## CI
Workflow: `.github/workflows/smoke-invite-375.yml`

- Installiert Chromium inkl. Linux-Systembibliotheken via
  `npx playwright install --with-deps chromium`.
- Baut die Astro-Seite und fuehrt den 375px-Smoke aus.
- Archiviert `playwright-report/` und `test-results/`.
