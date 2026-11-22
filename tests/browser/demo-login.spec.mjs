import { test, expect } from '@playwright/test';

test('demo login rejects wrong credentials, persists in the tab, exposes profile and signs out', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in to Flowra' })).toBeVisible();
  await expect(page.getByText('flowra2026', { exact: true })).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill('operator');
  await page.getByLabel('Password', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'incorrect' })).toContainText('incorrect');
  await page.getByLabel('Password', { exact: true }).fill('flowra2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Operator profile', exact: true }).click();
  await page.getByRole('button', { name: 'View demo profile', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('not production authentication');
  await page.getByRole('button', { name: 'Close profile', exact: true }).click();
  await page.getByRole('button', { name: 'Operator profile', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Flowra' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in to Flowra' })).toBeVisible();
});

test('login and profile layouts fit narrow mobile and desktop', async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport); await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByLabel('Username', { exact: true }).fill('operator');
    await page.getByLabel('Password', { exact: true }).fill('flowra2026');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('button', { name: 'Operator profile', exact: true }).click();
    await expect(page.getByRole('button', { name: 'View demo profile' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    if (viewport.width === 390) await page.screenshot({ path: 'test-results/flowra-login-mobile.png', fullPage: true });
  }
});
