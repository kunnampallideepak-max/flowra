import { test, expect } from './fixtures.mjs';
import { demoControl } from './demo-controls.mjs';
import { LOCATIONS } from '../../lib/networks.mjs';
import { exampleFrame } from '../../lib/telemetry-example.mjs';
import { frameToState } from '../../lib/telemetry.mjs';
import { readFile } from 'node:fs/promises';
const navigate = (page, name) => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name, exact: true }).click();
async function snapshot(page) { const download = page.waitForEvent('download'); await page.getByRole('button', { name: /Export snapshot/ }).click(); return JSON.parse(await readFile(await (await download).path(), 'utf8')); }
async function chooseAluva(page, template = 'residential') { await navigate(page, 'Networks'); await page.getByRole('button', { name: /^Aluva/ }).click(); await page.getByLabel('Network', { exact: true }).selectOption(template); }

test('dependent pilot locations, conceptual templates and isolated simulations synchronize with the digital twin', async ({ page }) => {
  await demoControl(page, 'Pause'); const original = await snapshot(page);
  await navigate(page, 'Networks');
  await expect(page.getByLabel('District', { exact: true })).toBeDisabled();
  await page.getByLabel('State', { exact: true }).selectOption('kerala');
  await page.getByLabel('District', { exact: true }).selectOption('ernakulam');
  await page.getByLabel('Town / locality', { exact: true }).selectOption('aluva');
  await page.getByLabel('Network', { exact: true }).selectOption('residential');
  await expect(page.getByText('Illustrative network assigned to Aluva', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open this network in Digital twin' }).click();
  await expect(page.locator('.detailed-map')).toHaveAttribute('data-template', 'residential');
  await expect(page.locator('.network-context')).toContainText('Not a geographic pipe map');
  await page.evaluate(() => { for (const animation of document.getAnimations()) if (animation.effect?.getComputedTiming().endTime !== Infinity) animation.finish(); });
  await page.screenshot({ animations: 'disabled', path: 'test-results/networks/residential-twin.png', fullPage: true });
  await page.getByRole('button', { name: 'Inspect B', exact: true }).click();
  await page.getByLabel('Virtual valve B opening').fill('35'); await page.getByRole('button', { name: 'Apply virtual valves', exact: true }).click();
  const assigned = await snapshot(page); expect(assigned.network.location.locality).toBe('Aluva'); expect(assigned.valves[1]).toBe(35); expect(assigned.networkId).toContain(':aluva:residential');
  await navigate(page, 'Analysis & alerts'); await expect(page.getByRole('row').filter({ hasText: 'Zone B' }).first()).toContainText(assigned.zones[1].outflow.toLocaleString('en-IN', { maximumFractionDigits: 2 }));
  await navigate(page, 'Networks'); await expect(page.getByLabel('Town / locality', { exact: true })).toHaveValue('aluva');
  await page.getByRole('button', { name: 'Open default three-zone network' }).click(); const restored = await snapshot(page);
  expect(restored.tank).toBe(original.tank); expect(restored.valves).toEqual(original.valves); expect(restored.network.id).toBe('flowra-default');
  await chooseAluva(page); await page.getByRole('button', { name: 'Open this network in Digital twin' }).click(); expect((await snapshot(page)).valves[1]).toBe(35);
  await chooseAluva(page, 'community'); await page.getByRole('button', { name: 'Open this network in Digital twin' }).click();
  await expect(page.locator('.detailed-map')).toHaveAttribute('data-template', 'community'); expect((await snapshot(page)).valves[1]).toBe(100);
});

test('location loading, failed cache, retry, administrative reset and missing verified data remain honest', async ({ page }) => {
  let release; const pending = new Promise(resolve => release = resolve); let fail = true;
  await page.route('**/api/locations', async route => { if (fail) { await pending; await route.fulfill({ status: 503, json: {} }); } else await route.fulfill({ json: { states: LOCATIONS } }); });
  await page.reload(); await navigate(page, 'Networks');
  await expect(page.getByText('Loading the locally cached pilot directory...', { exact: true })).toBeVisible();
  await expect(page.getByLabel('State', { exact: true })).toBeDisabled(); fail = false; release();
  await expect(page.getByRole('alert').filter({ hasText: 'could not be loaded' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry directory' }).click();
  await page.getByRole('button', { name: /^Aluva/ }).click();
  await page.getByLabel('State', { exact: true }).selectOption('maharashtra');
  await expect(page.getByLabel('District', { exact: true })).toHaveValue(''); await expect(page.getByLabel('Town / locality', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('District', { exact: true }).locator('option')).toHaveText(['Select a district', 'Pune']);
  await page.getByLabel('District', { exact: true }).selectOption('pune');
  await expect(page.getByLabel('Town / locality', { exact: true }).locator('option')).toHaveText(['Select a locality', 'Baramati', 'Lonavala']);
  await page.getByRole('button', { name: 'Verified utility networks' }).click();
  await expect(page.getByRole('heading', { name: 'No verified utility networks available' })).toBeVisible();
});

test('choosing a place never reassociates the original connected device or fabricates a feed', async ({ page }) => {
  const state = frameToState(exampleFrame());
  await page.route('**/api/telemetry', route => route.fulfill({ json: { state, status: 'live', configured: true } }));
  await demoControl(page, 'Connected device'); await expect(page.locator('.live')).toHaveText('Device connected');
  await chooseAluva(page); await page.getByRole('button', { name: 'Open this network in Digital twin' }).click();
  await expect(page.getByRole('heading', { name: 'No connected telemetry for this network' })).toBeVisible();
  await expect(page.locator('.live')).toHaveText('No matching device'); await expect(page.locator('.detailed-map')).toBeHidden();
  await expect(page.getByRole('button', { name: /Export snapshot/ })).toBeDisabled();
  await navigate(page, 'Demo & settings'); await expect(page.getByRole('button', { name: 'Connected device', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.telemetry-facts')).not.toContainText(state.deviceId);
  await navigate(page, 'Networks'); await page.getByRole('button', { name: 'Open default three-zone network' }).click();
  await expect(page.locator('.live')).toHaveText('Device connected'); await page.getByRole('button', { name: 'Inspect B', exact: true }).click();
  await expect(page.getByTestId('zone-inlet')).toHaveText('21.6 L/min');
});

test('local authorised JSON review has strict validation and sends no file content to a server', async ({ page }) => {
  await demoControl(page, 'Pause'); const before = await snapshot(page); const posts = [];
  page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
  await navigate(page, 'Networks'); await page.getByText('Review an authorised network JSON locally', { exact: true }).click();
  await expect(page.getByLabel('Network JSON (maximum 50 KB)')).toBeDisabled();
  await page.getByLabel('I have permission to view this data in this browser').check();
  await page.getByLabel('Network JSON (maximum 50 KB)').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":1}') });
  await expect(page.getByRole('alert').filter({ hasText: 'could not be validated' })).toBeVisible();
  await page.getByLabel('Network JSON (maximum 50 KB)').setInputFiles('docs/network-import.example.json');
  await expect(page.getByText('Unverified import / read-only', { exact: true })).toBeVisible();
  await expect(page.getByText('4 nodes / 3 connections / 1 sensor identifiers. No readings supplied.')).toBeVisible();
  expect(posts).toEqual([]); expect((await snapshot(page)).tank).toBe(before.tank);
  await page.getByRole('button', { name: 'Clear local review' }).click(); await expect(page.getByText('Unverified import / read-only', { exact: true })).toHaveCount(0);
});

test('metadata, navigation motion, theme coverage and responsive network layouts', async ({ page }) => {
  await demoControl(page, 'Pause');
  await expect(page).toHaveTitle('Flowra | Water Intelligence');
  await expect(page.locator('link[rel="icon"][href*="icon.svg"]')).toHaveCount(1);
  expect((await page.request.get('/favicon.ico')).ok()).toBe(true); const icon = await (await page.request.get('/icon.svg')).text(); expect(icon).toContain('#95e7c0');
  const graph = await snapshot(page);
  for (const label of ['Networks', 'Overview', 'Digital twin', 'Analysis & alerts', 'Allocation lab', 'Ask Flowra', 'How Flowra works', 'Demo & settings']) await navigate(page, label);
  expect((await snapshot(page)).tank).toBe(graph.tank);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await navigate(page, 'Networks');
  expect(await page.locator('.page-stage').evaluate(element => element.getAnimations().length)).toBe(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await chooseAluva(page, 'community');
  for (const [width, height, mode] of [[1440,1000,'Light'], [1440,1000,'Dark'], [768,1024,'Dark'], [390,844,'Dark'], [320,568,'High contrast']]) {
    await page.setViewportSize({ width, height }); await page.getByRole('button', { name: 'Operator profile', exact: true }).click();
    await page.getByRole('radio', { name: mode, exact: true }).check(); await page.keyboard.press('Escape');
    await page.evaluate(() => { for (const animation of document.getAnimations()) if (animation.effect?.getComputedTiming().endTime !== Infinity) animation.finish(); });
    await page.screenshot({ animations: 'disabled', path: `test-results/networks/catalog-${width}-${mode.toLowerCase().replace(' ','-')}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Open this network in Digital twin' }).click();
    await page.evaluate(() => { for (const animation of document.getAnimations()) if (animation.effect?.getComputedTiming().endTime !== Infinity) animation.finish(); });
    await page.screenshot({ animations: 'disabled', path: `test-results/networks/twin-${width}-${mode.toLowerCase().replace(' ','-')}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await navigate(page, 'Networks');
  }
});
