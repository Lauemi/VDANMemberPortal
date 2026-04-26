import { expect, test } from '@playwright/test';

test('invite flow renders and submits at 375px', async ({ page }) => {
  let verifyRequests = 0;
  let signupRequests = 0;
  let loginRequests = 0;
  let claimRequests = 0;
  let claimPayload: Record<string, unknown> | null = null;

  await page.route('**/functions/v1/club-invite-verify', async (route) => {
    verifyRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        invite_token: 'smoke-token-375',
        club_id: 'club-375',
        club_code: 'SC375',
        club_name: 'Smoke Club',
        member_no: 'SC375-01',
        invite: {
          member_no: 'SC375-01',
        },
      }),
    });
  });

  await page.route('**/auth/v1/signup', async (route) => {
    signupRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'smoke-user-375',
          email: 'smoke-375@example.org',
        },
      }),
    });
  });

  await page.route('**/auth/v1/token?grant_type=password', async (route) => {
    loginRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'smoke-access-token-375',
        refresh_token: 'smoke-refresh-token-375',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: 'smoke-user-375',
          email: 'smoke-375@example.org',
        },
      }),
    });
  });

  await page.route('**/functions/v1/club-invite-claim', async (route) => {
    claimRequests += 1;
    claimPayload = route.request().postDataJSON() as Record<string, unknown> | null;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('/vereinssignin/?invite=smoke-token-375&club_name=Smoke%20Club&club_code=SC375&member_no=SC375-01', {
    waitUntil: 'domcontentloaded',
  });

  const consentBanner = page.locator('#consentBanner');
  if (await consentBanner.isVisible()) {
    await page.getByRole('button', { name: 'Nur notwendige' }).click();
    await expect(consentBanner).toBeHidden();
  }

  await expect(page.getByRole('heading', { name: 'Bestehendem Verein beitreten' })).toBeVisible();
  await expect(page.locator('#registerForm')).toHaveAttribute('data-has-invite-context', 'false');
  await expect(page.getByRole('heading', { name: 'Pfad A: Bestehendes Konto (Login-first)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pfad B: Neues Konto anlegen' })).toBeVisible();
  await expect(page.locator('#registerInviteToken')).toHaveValue('smoke-token-375');
  await expect(page.locator('#loginInviteMemberNo')).toBeVisible();
  await expect(page.locator('#loginInviteMemberNo')).toHaveValue('SC375-01');
  await expect(page.locator('#registerInviteContextCopy')).toContainText('Du trittst dem Verein Smoke Club bei.');

  const submitButton = page.locator('#registerSubmitBtn');
  await expect(submitButton).toBeVisible();
  await expect(submitButton).toContainText('Konto anlegen');

  await page.locator('#registerMobileSubmitAnchor').click();
  await expect(page).toHaveURL(/#registerSubmitBtn$/);
  await expect(submitButton).toBeInViewport();

  await page.locator('#loginMemberNo').fill('smoke-375@example.org');
  await page.locator('#loginPass').fill('SmokePass#375');
  await page.getByRole('button', { name: 'Einloggen und Verein beitreten' }).click();

  await expect.poll(() => loginRequests).toBe(1);
  await expect.poll(() => claimRequests).toBe(1);
  expect(verifyRequests).toBeGreaterThanOrEqual(2);
  expect(loginRequests).toBe(1);
  expect(claimRequests).toBe(1);
  expect(signupRequests).toBe(0);
  expect(claimPayload).toMatchObject({
    invite_token: 'smoke-token-375',
    member_no: 'SC375-01',
  });
});
