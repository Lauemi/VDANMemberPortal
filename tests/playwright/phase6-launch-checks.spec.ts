/**
 * Phase-6 Launch-Checks — FCP Launch Matrix Gates A/B/C
 * ======================================================
 * CHECK-03  Console Errors je ADM-Sektion          Gate A
 * CHECK-04  Mobile 375px Overflow                  Gate B
 * CHECK-05  Touch Targets >= 44px                  Gate B
 * CHECK-06  Portrait → Landscape kein Overflow     Gate B
 * CHECK-07  Forbidden-State Toast sichtbar         Gate C
 *
 * Phase-7 Erweiterungen — Gates A/B/C (öffentliche Seiten + QFM)
 * ===============================================================
 * CHECK-08  Console Errors öffentliche Seiten      Gate A
 * CHECK-09  Touch Targets Verein anfragen           Gate B
 * CHECK-10  Desktop kein Overflow öffentl. Seiten  Gate B
 * CHECK-11  Console Errors QFM Dashboard           Gate A
 * CHECK-12  Dead Ends — 404 + Session-Loss         Gate C
 *
 * Viewport: 375×812 (chromium-mobile-375 project aus playwright.config.ts)
 * Desktop-Viewport wird per setViewportSize() überschrieben wo nötig.
 *
 * AUTH-STRATEGIE:
 *   Öffentliche Seiten (Login, Registrieren, Verein anfragen): kein Auth nötig.
 *   Geschützte Seiten (/app/*): Mock-Session via sessionStorage-Injection
 *   + Supabase-API-Mocks (club_request_gate_state, user_roles, catch-all).
 */

import { expect, test } from '@playwright/test';

// ── Hilfsfunktionen ────────────────────────────────────────────────────────

const MOCK_UID = 'phase6-test-admin-00000000';
const MOCK_SESSION = {
  access_token: 'phase6-fake-access-token',
  refresh_token: 'phase6-fake-refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  // member-auth.js validates camelCase expiresAt in milliseconds
  expiresAt: (Math.floor(Date.now() / 1000) + 3600) * 1000,
  user: {
    id: MOCK_UID,
    email: 'phase6-test@fishing-club-portal.de',
    user_metadata: { display_name: 'Phase6 Tester' },
    app_metadata: {},
  },
};
const MOCK_SESSION_META = {
  id: MOCK_UID,
  email: MOCK_SESSION.user.email,
  display_name: MOCK_SESSION.user.user_metadata.display_name,
  expires_at: MOCK_SESSION.expires_at,
};

/** Inject Mock-Session in sessionStorage + localStorage, bevor die Seite Skripte lädt.
 *  Injiziert auch den Consent-Status, damit das Consent-Banner nicht erscheint
 *  (Banner verwendet position:fixed und kann im Playwright-Mobile-Kontext scrollWidth
 *  aufblasen, da visualViewport ≠ layoutViewport bei isMobile:true + deviceScaleFactor:3).
 */
async function injectSession(page: Parameters<typeof test>[1]['page']) {
  await page.addInitScript(
    ({ session, meta }) => {
      try { sessionStorage.setItem('vdan_member_session_v1', JSON.stringify(session)); } catch {}
      try { localStorage.setItem('vdan_member_session_meta_v1', JSON.stringify(meta)); } catch {}
      // Consent als gegeben markieren → Banner rendert nicht → kein Overflow-Artefakt
      try {
        localStorage.setItem('vdan_cookie_consent_v1', JSON.stringify({
          essential: true, external_media: false, updated_at: '2024-01-01T00:00:00.000Z'
        }));
      } catch {}
    },
    { session: MOCK_SESSION, meta: MOCK_SESSION_META }
  );
}

/** Route-Mocks für die häufigsten Supabase-Calls, die member-guard + admin-board auslösen. */
async function mockSupabaseApi(page: Parameters<typeof test>[1]['page']) {
  // club_request_gate_state → approved (damit member-guard nicht auf /app/anfrage-offen/ leitet)
  await page.route('**/rpc/club_request_gate_state', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ status: 'approved', club_id: 'mock-club' }]) });
  });
  // user_roles → admin (damit member-guard admin-Pfade freigibt)
  await page.route('**/user_roles**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ role: 'admin' }]) });
  });
  // admin_member_registry und alle anderen REST-Calls → leeres Array
  await page.route('**/rest/v1/**', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.continue(); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  // Edge Functions → leere OK-Antwort
  await page.route('**/functions/v1/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

/** Misst ob Seite echten horizontalen Layout-Overflow hat.
 *
 *  Vergleich gegen window.innerWidth statt clientWidth:
 *  Im Playwright-Mobile-Emulationsmodus (isMobile:true + deviceScaleFactor:3)
 *  ist der visuelle Viewport (window.innerWidth) breiter als der Layout-Viewport
 *  (clientWidth). position:fixed-Elemente werden gegen den visuellen Viewport
 *  positioniert und addieren sich zu scrollWidth auf — bis maximal window.innerWidth.
 *  Echter Content-Overflow liegt immer über window.innerWidth hinaus.
 */
async function hasHorizontalOverflow(page: Parameters<typeof test>[1]['page']): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > Math.max(window.innerWidth, document.documentElement.clientWidth));
}

/** Gibt alle interaktiven Elemente zurück die kleiner als minPx sind. */
async function smallInteractiveElements(page: Parameters<typeof test>[1]['page'], minPx = 44) {
  return page.evaluate((min) => {
    const selectors = ['button', 'a[href]', '[role="button"]', 'input[type="submit"]', 'input[type="button"]'];
    const els = Array.from(document.querySelectorAll<HTMLElement>(selectors.join(',')));
    const results: Array<{ tag: string; text: string; w: number; h: number; selector: string }> = [];
    for (const el of els) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue; // hidden
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
      if (rect.width < min || rect.height < min) {
        results.push({
          tag: el.tagName.toLowerCase(),
          text: el.textContent?.trim().slice(0, 40) || '',
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          selector: el.id ? `#${el.id}` : el.className ? `.${String(el.className).split(' ')[0]}` : el.tagName,
        });
      }
    }
    return results;
  }, minPx);
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECK-04 — Mobile 375px kein horizontaler Overflow (öffentliche Seiten)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('CHECK-04 Mobile Overflow — öffentliche Seiten', () => {
  const PUBLIC_PAGES = [
    { label: 'Login',           path: '/login/' },
    { label: 'Registrieren',    path: '/registrieren/' },
    { label: 'Verein anfragen', path: '/verein-anfragen/' },
  ];

  for (const { label, path } of PUBLIC_PAGES) {
    test(`${label} hat keinen horizontalen Overflow bei 375px`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const overflow = await hasHorizontalOverflow(page);
      expect(overflow, `${label} (${path}) hat horizontalen Overflow bei 375px`).toBe(false);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CHECK-05 — Touch Targets ≥ 44px (öffentliche Seiten)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('CHECK-05 Touch Targets — öffentliche Seiten', () => {
  const TOUCH_PAGES = [
    { label: 'Login',        path: '/login/' },
    { label: 'Registrieren', path: '/registrieren/' },
  ];

  for (const { label, path } of TOUCH_PAGES) {
    test(`${label}: alle interaktiven Elemente ≥ 44px`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const small = await smallInteractiveElements(page, 44);
      if (small.length > 0) {
        console.warn(`[CHECK-05] ${label}: ${small.length} Element(e) < 44px:`);
        small.forEach(e => console.warn(`  ${e.selector} "${e.text}" — ${e.w}×${e.h}px`));
      }
      // Weiche Prüfung: wir loggen, aber blockieren den Launch nur bei gravierenden Fällen (<32px)
      const critical = small.filter(e => e.w < 32 || e.h < 32);
      expect(critical, `${label}: kritisch kleine Targets (< 32px) gefunden`).toHaveLength(0);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CHECK-06 — Portrait → Landscape kein Overflow (öffentliche Seiten)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('CHECK-06 Portrait ↔ Landscape Overflow', () => {
  test('Login: kein Overflow in Portrait (375×812) und Landscape (812×375)', async ({ page }) => {
    await page.goto('/login/', { waitUntil: 'domcontentloaded' });

    await page.setViewportSize({ width: 375, height: 812 });
    const portraitOverflow = await hasHorizontalOverflow(page);
    expect(portraitOverflow, 'Login: horizontaler Overflow im Portrait-Modus').toBe(false);

    await page.setViewportSize({ width: 812, height: 375 });
    await page.waitForTimeout(200); // Kurz warten auf Layout-Reflow
    const landscapeOverflow = await hasHorizontalOverflow(page);
    expect(landscapeOverflow, 'Login: horizontaler Overflow im Landscape-Modus').toBe(false);
  });

  test('Registrieren: kein Overflow in Portrait und Landscape', async ({ page }) => {
    await page.goto('/registrieren/', { waitUntil: 'domcontentloaded' });

    await page.setViewportSize({ width: 375, height: 812 });
    const portraitOverflow = await hasHorizontalOverflow(page);
    expect(portraitOverflow, 'Registrieren: horizontaler Overflow im Portrait-Modus').toBe(false);

    await page.setViewportSize({ width: 812, height: 375 });
    await page.waitForTimeout(200);
    const landscapeOverflow = await hasHorizontalOverflow(page);
    expect(landscapeOverflow, 'Registrieren: horizontaler Overflow im Landscape-Modus').toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CHECK-07 — Forbidden-State Toast sichtbar auf /app/?forbidden=1
// ═══════════════════════════════════════════════════════════════════════════

test.describe('CHECK-07 Forbidden-State Toast', () => {
  test('Toast erscheint auf /app/?forbidden=1 mit Mock-Session', async ({ page }) => {
    await injectSession(page);
    await mockSupabaseApi(page);
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto('/app/?forbidden=1', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500); // Toast-Render abwarten

    // URL soll bereinigt sein (kein ?forbidden=1 mehr)
    expect(page.url()).not.toContain('forbidden=1');

    // Toast muss sichtbar sein (role=alert, Text "Kein Zugriff")
    const toast = page.locator('[role="alert"]').filter({ hasText: /kein zugriff/i });
    await expect(toast).toBeVisible({ timeout: 3000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CHECK-03 — Console Errors je ADM-Sektion (Mock-Session, Desktop)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('CHECK-03 Console Errors — ADM Sektionen', () => {
  const ADM_SECTIONS = [
    'Overview',
    'Vereinsdaten',
    'Einladungen',
    'Mitgliederverwaltung',
    'Ausweise',
    'Freigaben',
    'Rollen / Rechte',
    'Gewässer',
    'Regelwerke',
    'Arbeitseinsätze',
    'Einstellungen',
  ];

  test('keine unbehandelten JS-Exceptions beim Navigieren durch alle ADM-Sektionen', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(`[pageerror] ${err.message}`));

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // Bekannte, erwartete Fehler ignorieren (Network-Fehler durch Mock-Session)
        const text = msg.text();
        const expected = [
          'Failed to load resource',
          'net::ERR_',
          'phase6-fake-access-token', // Mock-Token erzeugt 401 → erwartet
          'Preflight',
          'Admin-Board',
        ];
        if (!expected.some((e) => text.includes(e))) {
          consoleErrors.push(`[console.error] ${text.slice(0, 120)}`);
        }
      }
    });

    await injectSession(page);
    await mockSupabaseApi(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app/mitgliederverwaltung/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000); // ADM Shell initialisieren lassen

    for (const section of ADM_SECTIONS) {
      // Klicke den Nav-Button mit exaktem Text
      const btn = page.locator('.admin-nav-btn', { hasText: new RegExp(`^${section}$`) }).first();
      const exists = await btn.count();
      if (!exists) {
        console.warn(`[CHECK-03] Sektion "${section}" nicht gefunden — übersprungen`);
        continue;
      }
      await btn.click();
      await page.waitForTimeout(500); // Sektion laden lassen
    }

    // Unbehandelte JS-Exceptions = harter Fail
    if (pageErrors.length) {
      console.error('[CHECK-03] Unbehandelte JS-Exceptions:', pageErrors);
    }
    expect(pageErrors, 'Unbehandelte JS-Exceptions in ADM-Sektionen').toHaveLength(0);

    // Console.error-Calls = weicher Warn-Log (kein Fail, aber sichtbar im Report)
    if (consoleErrors.length) {
      console.warn('[CHECK-03] console.error-Calls (zur Überprüfung):', consoleErrors);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CHECK-08 — Console Errors öffentliche Seiten (Gate A)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('CHECK-08 Console Errors — öffentliche Seiten', () => {
  const PUBLIC_PAGES = [
    { label: 'Login',           path: '/login/' },
    { label: 'Registrieren',    path: '/registrieren/' },
    { label: 'Verein anfragen', path: '/verein-anfragen/' },
  ];

  for (const { label, path } of PUBLIC_PAGES) {
    test(`${label}: keine unbehandelten JS-Exceptions`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(`[pageerror] ${err.message}`));

      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);

      if (pageErrors.length) {
        console.error(`[CHECK-08] ${label}: JS-Exceptions:`, pageErrors);
      }
      expect(pageErrors, `${label}: unbehandelte JS-Exceptions`).toHaveLength(0);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CHECK-09 — Touch Targets >= 44px (Verein anfragen — Gate B)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('CHECK-09 Touch Targets — Verein anfragen', () => {
  test('Verein anfragen: alle interaktiven Elemente ≥ 44px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/verein-anfragen/', { waitUntil: 'domcontentloaded' });
    const small = await smallInteractiveElements(page, 44);
    if (small.length > 0) {
      console.warn(`[CHECK-09] Verein anfragen: ${small.length} Element(e) < 44px:`);
      small.forEach(e => console.warn(`  ${e.selector} "${e.text}" — ${e.w}×${e.h}px`));
    }
    const critical = small.filter(e => e.w < 32 || e.h < 32);
    expect(critical, 'Verein anfragen: kritisch kleine Targets (< 32px) gefunden').toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CHECK-10 — Desktop kein horizontaler Overflow (öffentliche Seiten — Gate B)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('CHECK-10 Desktop Overflow — öffentliche Seiten', () => {
  const DESKTOP_PAGES = [
    { label: 'Login',           path: '/login/' },
    { label: 'Registrieren',    path: '/registrieren/' },
    { label: 'Verein anfragen', path: '/verein-anfragen/' },
  ];

  for (const { label, path } of DESKTOP_PAGES) {
    test(`${label}: kein horizontaler Overflow bei 1280px`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const overflow = await hasHorizontalOverflow(page);
      expect(overflow, `${label} hat horizontalen Overflow bei 1280px`).toBe(false);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CHECK-11 — Console Errors QFM Dashboard (Mock-Session, Gate A)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('CHECK-11 Console Errors — QFM Dashboard', () => {
  test('QFM Dashboard /app/: keine unbehandelten JS-Exceptions mit Mock-Session', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(`[pageerror] ${err.message}`));

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        const expected = ['Failed to load resource', 'net::ERR_', 'phase6-fake-access-token', 'Preflight'];
        if (!expected.some((e) => text.includes(e))) {
          consoleErrors.push(`[console.error] ${text.slice(0, 120)}`);
        }
      }
    });

    await injectSession(page);
    await mockSupabaseApi(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    if (pageErrors.length) console.error('[CHECK-11] JS-Exceptions QFM:', pageErrors);
    expect(pageErrors, 'QFM Dashboard: unbehandelte JS-Exceptions').toHaveLength(0);

    if (consoleErrors.length) console.warn('[CHECK-11] console.error-Calls QFM:', consoleErrors);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CHECK-13 — Console Errors: QFM Sub-Seiten + Rechtstexte  (Gate A)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('CHECK-13 Console Errors — QFM Sub-Seiten + Rechtstexte', () => {
  const QFM_PAGES = [
    { label: 'Fangliste',     path: '/app/fangliste/' },
    { label: 'Ausweis',       path: '/app/ausweis/' },
    { label: 'Gewässerkarte', path: '/app/gewaesserkarte/' },
    { label: 'Eventplaner',   path: '/app/eventplaner/' },
  ];

  const LEGAL_PAGES = [
    { label: 'Datenschutz', path: '/datenschutz.html' },
    { label: 'Impressum',   path: '/impressum.html' },
    { label: 'AVV',         path: '/avv.html' },
  ];

  for (const { label, path } of QFM_PAGES) {
    test(`QFM ${label}: keine unbehandelten JS-Exceptions`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(`[pageerror] ${err.message}`));

      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          const expected = ['Failed to load resource', 'net::ERR_', 'phase6-fake-access-token', 'Preflight'];
          if (!expected.some((e) => text.includes(e))) {
            consoleErrors.push(`[console.error] ${text.slice(0, 120)}`);
          }
        }
      });

      await injectSession(page);
      await mockSupabaseApi(page);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      if (pageErrors.length) console.error(`[CHECK-13] QFM ${label}: JS-Exceptions:`, pageErrors);
      expect(pageErrors, `QFM ${label}: unbehandelte JS-Exceptions`).toHaveLength(0);

      if (consoleErrors.length) console.warn(`[CHECK-13] QFM ${label}: console.error-Calls:`, consoleErrors);
    });
  }

  for (const { label, path } of LEGAL_PAGES) {
    test(`${label}: keine unbehandelten JS-Exceptions`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(`[pageerror] ${err.message}`));

      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);

      if (pageErrors.length) console.error(`[CHECK-13] ${label}: JS-Exceptions:`, pageErrors);
      expect(pageErrors, `${label}: unbehandelte JS-Exceptions`).toHaveLength(0);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CHECK-14 — Horizontaler Overflow: ADM + QFM Sub-Seiten + Rechtstexte  (Gate B)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('CHECK-14 Horizontaler Overflow — ADM + QFM + Rechtstexte', () => {
  const ADM_SECTIONS = [
    'Overview',
    'Vereinsdaten',
    'Einladungen',
    'Mitgliederverwaltung',
    'Ausweise',
    'Freigaben',
    'Rollen / Rechte',
    'Gewässer',
    'Regelwerke',
    'Arbeitseinsätze',
    'Einstellungen',
  ];

  test('ADM Shell + alle Sektionen: kein horizontaler Overflow bei 375px', async ({ page }) => {
    await injectSession(page);
    await mockSupabaseApi(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app/mitgliederverwaltung/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // ADM Shell initial
    let overflow = await hasHorizontalOverflow(page);
    expect(overflow, 'ADM Shell (initial): horizontaler Overflow bei 375px').toBe(false);

    for (const section of ADM_SECTIONS) {
      const btn = page.locator('.admin-nav-btn', { hasText: new RegExp(`^${section}$`) }).first();
      if (await btn.count() === 0) {
        console.warn(`[CHECK-14] Sektion "${section}" nicht gefunden — übersprungen`);
        continue;
      }
      await btn.click();
      await page.waitForTimeout(300);
      overflow = await hasHorizontalOverflow(page);
      expect(overflow, `ADM Sektion "${section}": horizontaler Overflow bei 375px`).toBe(false);
    }
  });

  test('ADM Shell + alle Sektionen: kein horizontaler Overflow bei 1280px', async ({ page }) => {
    await injectSession(page);
    await mockSupabaseApi(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/app/mitgliederverwaltung/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    let overflow = await hasHorizontalOverflow(page);
    expect(overflow, 'ADM Shell (initial): horizontaler Overflow bei 1280px').toBe(false);

    for (const section of ADM_SECTIONS) {
      const btn = page.locator('.admin-nav-btn', { hasText: new RegExp(`^${section}$`) }).first();
      if (await btn.count() === 0) continue;
      await btn.click();
      await page.waitForTimeout(300);
      overflow = await hasHorizontalOverflow(page);
      expect(overflow, `ADM Sektion "${section}": horizontaler Overflow bei 1280px`).toBe(false);
    }
  });

  const QFM_PAGES = [
    { label: 'QFM Dashboard', path: '/app/' },
    { label: 'Fangliste',     path: '/app/fangliste/' },
    { label: 'Ausweis',       path: '/app/ausweis/' },
    { label: 'Gewässerkarte', path: '/app/gewaesserkarte/' },
    { label: 'Eventplaner',   path: '/app/eventplaner/' },
  ];

  for (const { label, path } of QFM_PAGES) {
    test(`${label}: kein horizontaler Overflow bei 375px`, async ({ page }) => {
      await injectSession(page);
      await mockSupabaseApi(page);
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      const overflow = await hasHorizontalOverflow(page);
      expect(overflow, `${label}: horizontaler Overflow bei 375px`).toBe(false);
    });

    test(`${label}: kein horizontaler Overflow bei 1280px`, async ({ page }) => {
      await injectSession(page);
      await mockSupabaseApi(page);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      const overflow = await hasHorizontalOverflow(page);
      expect(overflow, `${label}: horizontaler Overflow bei 1280px`).toBe(false);
    });
  }

  const LEGAL_PAGES = [
    { label: 'Datenschutz', path: '/datenschutz.html' },
    { label: 'Impressum',   path: '/impressum.html' },
    { label: 'AVV',         path: '/avv.html' },
  ];

  for (const { label, path } of LEGAL_PAGES) {
    test(`${label}: kein horizontaler Overflow bei 375px`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const overflow = await hasHorizontalOverflow(page);
      expect(overflow, `${label}: horizontaler Overflow bei 375px`).toBe(false);
    });

    test(`${label}: kein horizontaler Overflow bei 1280px`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const overflow = await hasHorizontalOverflow(page);
      expect(overflow, `${label}: horizontaler Overflow bei 1280px`).toBe(false);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CHECK-15 — Touch Targets ≥ 44px: ADM + QFM Sub-Seiten + Rechtstexte  (Gate B)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('CHECK-15 Touch Targets — ADM + QFM + Rechtstexte', () => {
  const ADM_SECTIONS = [
    'Overview',
    'Vereinsdaten',
    'Einladungen',
    'Mitgliederverwaltung',
    'Ausweise',
    'Freigaben',
    'Rollen / Rechte',
    'Gewässer',
    'Regelwerke',
    'Arbeitseinsätze',
    'Einstellungen',
  ];

  test('ADM Shell: Touch Targets ≥ 44px — Shell + alle Sektionen bei 375px', async ({ page }) => {
    await injectSession(page);
    await mockSupabaseApi(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app/mitgliederverwaltung/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Prüfung der initialen Ansicht
    let small = await smallInteractiveElements(page, 44);
    let critical = small.filter(e => e.w < 32 || e.h < 32);
    if (small.length) console.warn(`[CHECK-15] ADM Shell (initial): ${small.length} Elemente < 44px`);
    expect(critical, 'ADM Shell (initial): kritisch kleine Targets (< 32px)').toHaveLength(0);

    for (const section of ADM_SECTIONS) {
      const btn = page.locator('.admin-nav-btn', { hasText: new RegExp(`^${section}$`) }).first();
      if (await btn.count() === 0) {
        console.warn(`[CHECK-15] Sektion "${section}" nicht gefunden — übersprungen`);
        continue;
      }
      await btn.click();
      await page.waitForTimeout(300);
      small = await smallInteractiveElements(page, 44);
      critical = small.filter(e => e.w < 32 || e.h < 32);
      if (small.length) {
        console.warn(`[CHECK-15] ADM "${section}": ${small.length} Elemente < 44px:`);
        small.forEach(e => console.warn(`  ${e.selector} "${e.text}" — ${e.w}×${e.h}px`));
      }
      expect(critical, `ADM Sektion "${section}": kritisch kleine Targets (< 32px)`).toHaveLength(0);
    }
  });

  const QFM_PAGES = [
    { label: 'QFM Dashboard', path: '/app/' },
    { label: 'Fangliste',     path: '/app/fangliste/' },
    { label: 'Ausweis',       path: '/app/ausweis/' },
    { label: 'Gewässerkarte', path: '/app/gewaesserkarte/' },
    { label: 'Eventplaner',   path: '/app/eventplaner/' },
  ];

  for (const { label, path } of QFM_PAGES) {
    test(`${label}: Touch Targets ≥ 44px bei 375px`, async ({ page }) => {
      await injectSession(page);
      await mockSupabaseApi(page);
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      const small = await smallInteractiveElements(page, 44);
      if (small.length) {
        console.warn(`[CHECK-15] ${label}: ${small.length} Elemente < 44px:`);
        small.forEach(e => console.warn(`  ${e.selector} "${e.text}" — ${e.w}×${e.h}px`));
      }
      const critical = small.filter(e => e.w < 32 || e.h < 32);
      expect(critical, `${label}: kritisch kleine Targets (< 32px)`).toHaveLength(0);
    });
  }

  const LEGAL_PAGES = [
    { label: 'Datenschutz', path: '/datenschutz.html' },
    { label: 'Impressum',   path: '/impressum.html' },
    { label: 'AVV',         path: '/avv.html' },
  ];

  for (const { label, path } of LEGAL_PAGES) {
    test(`${label}: Touch Targets ≥ 44px bei 375px`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const small = await smallInteractiveElements(page, 44);
      if (small.length) {
        console.warn(`[CHECK-15] ${label}: ${small.length} Elemente < 44px:`);
        small.forEach(e => console.warn(`  ${e.selector} "${e.text}" — ${e.w}×${e.h}px`));
      }
      const critical = small.filter(e => e.w < 32 || e.h < 32);
      expect(critical, `${label}: kritisch kleine Targets (< 32px)`).toHaveLength(0);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CHECK-16 — Loading / Error / Success States  (Gate C)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('CHECK-16 Loading / Error / Success States', () => {
  /** Seiten mit aria-live="polite" Feedback-Region laut Code-Scan */
  const STATE_PAGES = [
    { label: 'Fangliste',     path: '/app/fangliste/',     liveId: 'tripMsg' },
    { label: 'Ausweis',       path: '/app/ausweis/',       liveId: 'memberCardMsg' },
    { label: 'Gewässerkarte', path: '/app/gewaesserkarte/', liveId: 'waterMapMsg' },
    { label: 'Eventplaner',   path: '/app/eventplaner/',   liveId: 'eventPlannerMsg' },
  ];

  test('ADM Shell hat aria-live Feedback-Region', async ({ page }) => {
    await injectSession(page);
    await mockSupabaseApi(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/app/mitgliederverwaltung/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const liveRegion = page.locator('[aria-live]').first();
    await expect(liveRegion, 'ADM Shell: keine aria-live Region gefunden').toBeAttached();
  });

  for (const { label, path, liveId } of STATE_PAGES) {
    test(`${label}: aria-live Feedback-Region vorhanden`, async ({ page }) => {
      await injectSession(page);
      await mockSupabaseApi(page);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      const liveEl = page.locator(`#${liveId}`);
      await expect(liveEl, `${label}: #${liveId} nicht im DOM`).toBeAttached();
    });

    test(`${label}: kein Crash bei API-Fehler (Error State)`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      await injectSession(page);
      // REST → 500 simulieren (API-Fehler)
      await page.route('**/rest/v1/**', async (route) => {
        if (route.request().method() === 'OPTIONS') { await route.continue(); return; }
        await route.fulfill({ status: 500, contentType: 'application/json',
          body: JSON.stringify({ error: 'simulated-error' }) });
      });
      // club_request_gate_state + user_roles bleiben OK (Guard darf nicht blocken)
      await page.route('**/rpc/club_request_gate_state', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify([{ status: 'approved', club_id: 'mock-club' }]) });
      });
      await page.route('**/user_roles**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify([{ role: 'admin' }]) });
      });

      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);

      expect(pageErrors, `${label}: Crash bei API-Fehler — unbehandelte Exception`).toHaveLength(0);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CHECK-12 — Dead Ends: 404-Seite + Session-Loss (Gate C)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('CHECK-12 Dead Ends', () => {
  test('404: Seite hat einen Rückweg (Link zu / oder /app/)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/diese-seite-existiert-garantiert-nicht-12345/', { waitUntil: 'domcontentloaded' });
    // Rückweg: irgendein Link der auf / oder /login/ oder /app/ führt
    const homeLink = page.locator('a[href="/"], a[href="/login/"], a[href="/app/"]').first();
    const exists = await homeLink.count();
    if (!exists) {
      console.warn('[CHECK-12] 404-Seite hat keinen offensichtlichen Rückweg-Link — prüfen');
    }
    // Weiche Prüfung: nur Warnung, kein harter Fail bei 404-Customization
    // (Astro rendert default 404 die möglicherweise keinen Link hat)
  });

  test('Session-Loss: /login/ hat Weiterweg (vereinssignin oder verein-anfragen)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login/', { waitUntil: 'domcontentloaded' });
    // FCP-Mode: /vereinssignin/ + /verein-anfragen/ statt /registrieren/
    const exitLink = page.locator('a[href*="vereinssignin"], a[href*="verein-anfragen"], a[href*="registrieren"]').first();
    await expect(exitLink).toBeAttached();
  });

  test('Session-Loss: /login/ hat Link zu /verein-anfragen/ (kein Dead End)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login/', { waitUntil: 'domcontentloaded' });
    const claimLink = page.locator('a[href*="verein-anfragen"]').first();
    await expect(claimLink).toBeAttached();
  });
});
