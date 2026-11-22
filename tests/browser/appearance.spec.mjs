import { demoControl, openDemoSettings } from './demo-controls.mjs';
import { test, expect } from '@playwright/test';
import { exampleFrame } from '../../lib/telemetry-example.mjs';
import { frameToState } from '../../lib/telemetry.mjs';
import { createSimulation } from '../../lib/simulation.mjs';

async function login(page) {
  await page.getByLabel('Username', { exact: true }).fill('operator');
  await page.getByLabel('Password', { exact: true }).fill('flowra2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
}
async function choose(page, name, loggedIn = true) {
  if (loggedIn) await page.getByRole('button', { name: 'Operator profile', exact: true }).click();
  else await page.getByRole('button', { name: 'Appearance settings', exact: true }).click();
  await page.getByRole('radio', { name, exact: true }).check();
  if (loggedIn) await page.keyboard.press('Escape');
  else await page.getByRole('button', { name: 'Appearance settings', exact: true }).click();
}
const theme = (page, value) => expect(page.locator('html')).toHaveAttribute('data-theme', value);
const capture = (page, name) => page.screenshot({ path: `test-results/appearance/${name}.png`, fullPage: true, animations: 'disabled' });

test('login themes, validation, password visibility, persistence and live system preference', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'light' }); await page.goto('/');
  await theme(page, 'light');
  await choose(page, 'Light', false); await capture(page, 'login-light');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#login-error')).toContainText('Enter both');
  await page.getByLabel('Password', { exact: true }).fill('flowra2026');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
  await choose(page, 'Dark', false); await theme(page, 'dark');
  await page.reload(); await theme(page, 'dark');
  await capture(page, 'login-dark');
  await choose(page, 'System', false); await theme(page, 'light');
  await page.emulateMedia({ colorScheme: 'dark' }); await theme(page, 'dark');
  await page.emulateMedia({ colorScheme: 'light' }); await theme(page, 'light');
  await choose(page, 'High contrast', false); await theme(page, 'contrast');
  await page.reload(); await theme(page, 'contrast');
  await login(page); await theme(page, 'contrast');
  expect(errors).toEqual([]);
});

test('all appearances cover dashboards, SVG, charts, profile keyboard and connected statuses', async ({ page }) => {
  await page.goto('/'); await login(page); await openDemoSettings(page); await expect(page.locator('.sim-time')).not.toHaveText('T+0 min'); await page.locator('.sidebar nav a[href="#overview"]').click(); await demoControl(page, 'Pause');
  await choose(page, 'Light'); await capture(page, 'overview-light');
  await openDemoSettings(page);
  const sourceGroup = page.getByRole('group', { name: 'Select data source' });
  expect(await sourceGroup.evaluate(element => getComputedStyle(element).display)).toBe('flex');
  const buttons = await sourceGroup.getByRole('button').all();
  const a = await buttons[0].boundingBox(), b = await buttons[1].boundingBox();
  expect(b.x - a.x - a.width).toBeGreaterThanOrEqual(5);
  await expect(buttons[0]).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.sidebar nav a[href="#overview"]').click();
  await choose(page, 'Dark'); await theme(page, 'dark'); await capture(page, 'overview-dark');
  const flowColor = await page.locator('#area stop').first().evaluate(element => getComputedStyle(element).stopColor);
  expect(flowColor).toBe('rgb(135, 229, 190)');
  const trigger = page.getByRole('button', { name: 'Operator profile', exact: true });
  await trigger.focus(); await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'View demo profile' })).toBeFocused();
  await capture(page, 'profile-menu-dark'); await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  for (const [label, name] of [['Digital twin', 'digital-twin-dark'], ['Ask Flowra', 'ask-flowra-dark']]) {
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: label, exact: true }).click(); await capture(page, name);
  }
  await page.getByRole('link', { name: 'Digital twin', exact: true }).click();
  await demoControl(page, 'Limited supply');
  await expect(page.locator('.tank-percent')).toHaveText(`${createSimulation('low').level.toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`);
  await capture(page, 'digital-twin-low-tank-dark');
  await demoControl(page, 'Normal operation');
  // No Gemini requests: only rendering is inspected in this appearance suite.
  const state = frameToState(exampleFrame()); let status = 'live';
  await page.route('**/api/telemetry', route => route.fulfill({ json: { state, status, configured: true } }));
  await demoControl(page, 'Connected device', true);
  await expect(page.getByText('Receiving readings', { exact: true })).toBeVisible();
  await expect(page.locator('.telemetry-facts')).toContainText(state.deviceId);
  await expect(page.locator('.telemetry-facts')).toContainText('synthetic telemetry');
  await capture(page, 'connected-device-dark');
  status = 'stale'; await expect(page.getByText('Stale readings', { exact: true })).toBeVisible();
  status = 'disconnected'; await expect(page.getByText('Device disconnected', { exact: true })).toBeVisible();
  await demoControl(page, 'Internal simulation');
  await choose(page, 'High contrast'); await theme(page, 'contrast');
  await capture(page, 'high-contrast');
  for (const appearance of ['Light', 'Dark', 'High contrast']) {
    await choose(page, appearance);
    for (const label of ['Overview', 'Digital twin', 'Analysis & alerts', 'Allocation lab', 'Ask Flowra', 'How Flowra works', 'Demo & settings']) {
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: label, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test('mobile controls, profile and pages fit without overflow in every appearance', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await choose(page, 'Dark', false); await capture(page, 'login-mobile-dark'); await login(page);
  await demoControl(page, 'Pause');
  for (const width of [390, 320, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const name of ['Light', 'Dark', 'High contrast']) {
      await choose(page, name);
      for (const label of ['Overview', 'Digital twin', 'Analysis & alerts', 'Allocation lab', 'Ask Flowra', 'How Flowra works', 'Demo & settings']) {
        await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: label, exact: true }).click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 }); await choose(page, 'Dark');
  await page.getByRole('link', { name: 'Overview', exact: true }).click(); await capture(page, 'overview-mobile-dark');
  await page.getByRole('button', { name: 'Operator profile', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'High contrast', exact: true })).toBeInViewport();
  await capture(page, 'profile-mobile-dark'); await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Digital twin', exact: true }).click(); await capture(page, 'digital-twin-mobile-dark');
  await page.route('**/api/telemetry', route => route.fulfill({ json: { state: frameToState(exampleFrame()), status: 'live', configured: true } }));
  await demoControl(page, 'Connected device', true);
  await expect(page.getByText('Receiving readings', { exact: true })).toBeVisible();
  await capture(page, 'connected-device-mobile-dark');
});
