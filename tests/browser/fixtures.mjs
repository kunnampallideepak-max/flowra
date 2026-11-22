import { test as base, expect } from '@playwright/test';
export const test = base.extend({
  demoSession: [async ({ page }, use) => {
    await page.goto('/');
    await page.getByLabel('Username', { exact: true }).fill('operator');
    await page.getByLabel('Password', { exact: true }).fill('flowra2026');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Overview', level: 1, exact: true })).toBeVisible();
    await use();
  }, { auto: true }]
});
export { expect };
