import { test, expect } from './fixtures.mjs';
import { demoControl, openDemoSettings } from './demo-controls.mjs';
import { DEMO_SESSION_KEY } from '../../lib/demo-access.mjs';
test.use({ trace: 'on' });
const nav = (page, name) => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name, exact: true }).click();
const settle = page => page.evaluate(() => { for (const animation of document.getAnimations()) if (animation.effect?.getComputedTiming().endTime !== Infinity) animation.finish(); });

test('sign-out invalidates immediately, removes the dashboard and reveals login through a neutral fade', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Operator profile', exact: true }).click();
  const immediate = await page.evaluate(key => {
    [...document.querySelectorAll('button')].find(button => button.textContent === 'Sign out').click();
    return { session: sessionStorage.getItem(key), dashboard: Boolean(document.querySelector('.app-shell')), login: Boolean(document.querySelector('#demo-username')), veil: Boolean(document.querySelector('.session-departure')) };
  }, DEMO_SESSION_KEY);
  expect(immediate).toEqual({ session: null, dashboard: false, login: true, veil: true });
  const samples = await page.evaluate(async () => {
    const veil = document.querySelector('.session-departure'), values = [];
    if (!veil) return values;
    const start = performance.now();
    while (performance.now() - start < 280) { values.push({ elapsed: performance.now() - start, opacity: Number(getComputedStyle(veil).opacity), attached: veil.isConnected }); await new Promise(requestAnimationFrame); }
    return values;
  });
  expect(samples.some(sample => sample.attached && sample.opacity > 0 && sample.opacity < 1)).toBe(true);
  await testInfo.attach('sign-out-browser-animation', { body: JSON.stringify(samples), contentType: 'application/json' });
  await expect(page.locator('.session-departure')).toHaveCount(0);
  await expect(page.getByLabel('Username', { exact: true })).toBeFocused();
  await page.reload(); await expect(page.getByRole('heading', { name: 'Sign in to Flowra' })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByLabel('Username', { exact: true }).fill('operator'); await page.getByLabel('Password', { exact: true }).fill('flowra2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('.session-arrival')).toHaveCSS('animation-name', 'none');
  await page.getByRole('button', { name: 'Operator profile', exact: true }).click(); await page.getByRole('button', { name: 'Sign out', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.session-departure')).toHaveCount(0); await expect(page.locator('.app-shell')).toHaveCount(0);
});

test('fixed profile hit area animates continuously, survives rapid crossing and stays expanded with its menu', async ({ page }, testInfo) => {
  await settle(page); await page.mouse.move(0, 0);
  const trigger = page.getByRole('button', { name: 'Operator profile', exact: true }), surface = page.locator('.profile-surface');
  await expect(surface).toHaveCSS('width', '44px');
  const box = await trigger.boundingBox(), avatar = await page.locator('.profile-avatar').boundingBox(), status = await page.locator('.live').boundingBox();
  expect(box.width).toBe(176);
  await expect(page.locator('.profile-avatar')).toHaveCSS('display', 'flex');
  await page.mouse.move(box.x + 150, box.y + 20);
  const samples = await page.evaluate(async () => {
    const surface = document.querySelector('.profile-surface'), values = [], start = performance.now();
    while (performance.now() - start < 300) { values.push({ time: performance.now() - start, width: surface.getBoundingClientRect().width, opacity: Number(getComputedStyle(document.querySelector('.profile-label')).opacity) }); await new Promise(requestAnimationFrame); }
    return values;
  });
  expect(samples.some(sample => sample.width > 44 && sample.width < 176)).toBe(true);
  await expect(trigger).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  for (let index = 1; index < samples.length; index++) expect(samples[index].width).toBeGreaterThanOrEqual(samples[index - 1].width);
  await testInfo.attach('profile-browser-frame-progression', { body: JSON.stringify(samples), contentType: 'application/json' });
  expect(await page.locator('.profile-avatar').boundingBox()).toEqual(avatar); expect(await page.locator('.live').boundingBox()).toEqual(status);
  for (let index = 0; index < 6; index++) { await page.mouse.move(box.x - 2, box.y + 20); await page.mouse.move(box.x + 170, box.y + 20); }
  await expect(surface).toHaveCSS('width', '176px'); await trigger.click(); await page.mouse.move(0, 0);
  await expect(surface).toHaveCSS('width', '176px'); await expect(page.locator('.profile-label')).toHaveCSS('opacity', '1');
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  await page.locator('h1').focus(); await expect(surface).toHaveCSS('width', '44px');
  await page.emulateMedia({ reducedMotion: 'reduce' }); await trigger.focus();
  await expect(surface).toHaveCSS('transition-duration', '0s'); await expect(surface).toHaveCSS('width', '176px');
});

test('settings removes duplication and analysis carries explicit evidence without overwriting a frozen conversation', async ({ page }) => {
  const requests = [];
  await page.route('**/api/explain', async route => { const input = route.request().postDataJSON(); requests.push(input); await route.fulfill({ json: { available: true, explanation: `The snapshot tank contains **${Math.round(input.tank)} L**. Synthetic readings only.` } }); });
  await demoControl(page, 'Pause'); await demoControl(page, 'Limited supply'); await nav(page, 'Analysis & alerts');
  await expect(page.locator('.assistant')).toBeHidden(); await expect(page.locator('.assistant')).toHaveCount(1);
  await page.locator('.alert summary').filter({ hasText: 'Low central tank' }).click();
  await page.getByRole('button', { name: 'Ask Flowra about this alert' }).click();
  await expect(page.locator('h1')).toHaveText('Ask Flowra'); await expect(page.getByLabel('Your question about this water network')).toHaveValue(/Low central tank/);
  expect(requests).toHaveLength(0); await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByText('Flowra Assistant', { exact: true })).toBeVisible(); expect(requests[0].scenario).toBe('low');
  await demoControl(page, 'Demand spike'); await nav(page, 'Analysis & alerts'); await page.getByRole('button', { name: 'Ask Flowra about current evidence' }).click();
  await expect(page.getByText('New evidence from Analysis', { exact: false })).toBeVisible();
  await expect(page.getByText('Flowra Assistant', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Keep frozen conversation' }).click(); await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByText('Flowra Assistant', { exact: true })).toHaveCount(2); expect(requests[1].scenario).toBe('low'); expect(requests[1].conversation).toHaveLength(2);
  await nav(page, 'Analysis & alerts'); await page.getByRole('button', { name: 'Ask Flowra about current evidence' }).click(); await page.getByRole('button', { name: 'Use alert snapshot' }).click();
  await expect(page.getByText('Flowra Assistant', { exact: true })).toHaveCount(0); await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByText('Flowra Assistant', { exact: true })).toBeVisible(); expect(requests[2].scenario).toBe('spike'); expect(requests[2].conversation).toEqual([]);
  for (const name of ['Overview', 'Networks', 'Digital twin', 'Analysis & alerts', 'Allocation lab', 'Ask Flowra', 'How Flowra works', 'Demo & settings']) { await nav(page, name); await expect(page.getByRole('link', { name: 'Demo controls & data details' })).toHaveCount(0); }
  await expect(page.getByText('Small network.', { exact: false })).toHaveCount(0); await expect(page.getByRole('link', { name: 'Learn how Flowra works' })).toHaveCount(0);
  const order = await page.locator('.settings-controls .panel h2').allTextContents(); expect(order).toEqual(['Data source & connection', 'Scenario studio', 'Simulation controls']);
  for (const title of ['Simulation assumptions', 'Detection and forecasting methodology', 'Data and sensor limitations', 'Connected devices and hardware', 'AI explanations and limitations']) { const section = page.locator('.technical-accordion').filter({ hasText: title }); await section.getByRole('button', { name: title, exact: true }).click(); await expect(section).toHaveAttribute('data-open', 'true'); }
  await expect(page.locator('.technical-notes')).toContainText('No calibrated confidence interval');
});

test('soft surface design remains readable on desktop and mobile in light and dark', async ({ page }) => {
  await demoControl(page, 'Pause');
  for (const [width, height] of [[1440,1000], [390,844]]) for (const mode of ['Light', 'Dark']) {
    await page.setViewportSize({ width, height }); await expect(page.locator('.profile-avatar')).toHaveCSS('display', 'flex'); await page.getByRole('button', { name: 'Operator profile', exact: true }).click(); await page.getByRole('radio', { name: mode, exact: true }).check(); await page.keyboard.press('Escape'); await page.locator('h1').focus();
    for (const name of ['Overview', 'Demo & settings', 'Analysis & alerts', 'Ask Flowra']) { await nav(page, name); await settle(page); await page.screenshot({ animations: 'disabled', path: `test-results/final-ux/${name.split(' ')[0].toLowerCase()}-${width}-${mode.toLowerCase()}.png`, fullPage: true }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
    await page.getByRole('button', { name: 'Operator profile', exact: true }).click(); await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await expect(page.locator('.session-departure')).toHaveCount(0); await settle(page);
    await page.screenshot({ animations: 'disabled', path: `test-results/final-ux/login-${width}-${mode.toLowerCase()}.png`, fullPage: true });
    await page.getByLabel('Username', { exact: true }).fill('operator'); await page.getByLabel('Password', { exact: true }).fill('flowra2026'); await page.getByRole('button', { name: 'Sign in' }).click(); await openDemoSettings(page); await page.getByRole('button', { name: 'Pause', exact: true }).click();
  }
});
