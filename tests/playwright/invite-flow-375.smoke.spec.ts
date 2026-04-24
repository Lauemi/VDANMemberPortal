import { expect, test } from '@playwright/test';

test('invite flow renders and submits at 375px', async ({ page }) => {
  let verifyRequests = 0;
  let signupRequests = 0;

  await page.route('**/functions/v1/club-invite-verify', async (route) => {
    verifyRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        invite_token: 'smoke-token-375',
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

  await page.goto('/vereinssignin/?invite=smoke-token-375&club_name=Smoke%20Club&club_code=SC375', {
    waitUntil: 'domcontentloaded',
  });

  const consentBanner = page.locator('#consentBanner');
  if (await consentBanner.isVisible()) {
    await page.getByRole('button', { name: 'Nur notwendige' }).click();
    await expect(consentBanner).toBeHidden();
  }

  await expect(page.getByRole('heading', { name: 'Bestehendem Verein beitreten' })).toBeVisible();
  await expect(page.locator('#registerForm')).toHaveAttribute('data-has-invite-context', 'false');
  await expect(page.locator('#registerInviteToken')).toHaveValue('smoke-token-375');
  await expect(page.locator('#registerInviteContextCopy')).toContainText('Du trittst dem Verein Smoke Club bei.');

  const submitButton = page.locator('#registerSubmitBtn');
  await expect(submitButton).toBeVisible();
  await expect(submitButton).toContainText('Konto anlegen');

  await page.locator('#registerMobileSubmitAnchor').click();
  await expect(page).toHaveURL(/#registerSubmitBtn$/);
  await expect(submitButton).toBeInViewport();

  await page.locator('#registerEmail').fill('smoke-375@example.org');
  await page.locator('#registerPass').fill('SmokePass#375');
  await page.locator('#registerPass2').fill('SmokePass#375');
  await page.locator('#registerMemberNo').fill('SC375-01');
  await page.locator('#registerAccept').check();
  await submitButton.click();

  await expect(page.locator('#registerMsg')).toContainText('Registrierung gespeichert.');
  expect(verifyRequests).toBeGreaterThanOrEqual(2);
  expect(signupRequests).toBe(1);
});
