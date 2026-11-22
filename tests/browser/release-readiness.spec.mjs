import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { DEMO_USER, DEMO_PASSWORD } from '../../lib/demo-access.mjs';
import { exampleFrame } from '../../lib/telemetry-example.mjs';
import { frameToState } from '../../lib/telemetry.mjs';
import { demoControl } from './demo-controls.mjs';

async function signIn(page, address) {
  await page.goto(address);
  await page.getByLabel('Username', { exact: true }).fill(DEMO_USER);
  await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
}

test('fractional connected alert times read in minutes and seconds while exports retain precision', async ({ page }) => {
  const end = Date.now();
  let state;
  for (let sequence = 0; sequence <= 56; sequence++) {
    const now = end - (56 - sequence) * 5000;
    state = frameToState(exampleFrame({ now, sequence, scenario: sequence >= 54 ? 'leak' : 'normal' }), state, now);
  }
  expect(state.events.at(-1).minute).toBe(280 / 60);
  await page.route('**/api/telemetry', route => route.fulfill({ json: { status: 'live', state, configured: true } }));
  await signIn(page, '/');
  await demoControl(page, 'Connected device');
  await page.getByRole('navigation').getByRole('link', { name: 'Analysis & alerts' }).click();
  const leakEvent = page.locator('.timeline').filter({ hasText: 'Suspected leak' });
  await expect(leakEvent.getByText('T+4 min 40 sec', { exact: true })).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export snapshot/ }).click();
  const download = await downloading;
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(exported.events.at(-1).minute).toBe(280 / 60);
  expect(exported.minute).toBe(280 / 60);
});

test('Explain this snapshot reaches the real route from the IPv4 loopback browser origin', async ({ page, baseURL }) => {
  const address = new URL(baseURL);
  address.hostname = '127.0.0.1';
  await signIn(page, address.href);
  await page.getByRole('navigation').getByRole('link', { name: 'Analysis & alerts' }).click();
  const response = page.waitForResponse(r => r.url() === address.origin + '/api/explain');
  await page.getByRole('button', { name: 'Explain this snapshot' }).click();
  const result = await response;
  expect(await result.request().headerValue('origin')).toBe(address.origin);
  expect(result.status()).toBe(503);
  expect((await result.json()).errorCode).toBe('NOT_CONFIGURED');
  await expect(page.locator('.ai-result')).toContainText('Rules-based fallback');
  await expect(page.locator('.ai-result')).toContainText('the tank holds');
});
