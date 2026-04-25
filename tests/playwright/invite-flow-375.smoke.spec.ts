import { expect, test } from '@playwright/test';

test('invite flow renders and is actionable at 375px', async ({ page }) => {
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
  const inviteTokenInput = page.locator('#registerInviteToken');
  const existingInviteToken = await inviteTokenInput.inputValue();
  if (!existingInviteToken) {
    await inviteTokenInput.fill('smoke-token-375');
  }

  const submitButton = page.locator('#registerSubmitBtn');
  await expect(submitButton).toBeVisible();
  await expect(submitButton).toContainText('Konto anlegen');
  await expect(page.locator('#registerMobileSubmitAnchor')).toBeVisible();

  await page.locator('#registerMobileSubmitAnchor').click();
  await expect(page).toHaveURL(/#registerSubmitBtn$/);
  await expect(submitButton).toBeInViewport();

  const hasHorizontalOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth;
  });
  expect(hasHorizontalOverflow).toBeFalsy();

  await page.locator('#registerEmail').fill('smoke-375@example.org');
  await page.locator('#registerPass').fill('SmokePass#375');
  await page.locator('#registerPass2').fill('SmokePass#375');
  await page.locator('#registerMemberNo').fill('SC375-01');
  await page.locator('#registerAccept').check();
  await expect(submitButton).toBeEnabled();
  await page.screenshot({ path: 'test-results/invite-flow-375-mobile.png', fullPage: true });
});
