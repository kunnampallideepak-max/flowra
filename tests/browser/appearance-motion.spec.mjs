import { test, expect } from '@playwright/test';
import { demoControl, openDemoSettings } from './demo-controls.mjs';
test.use({ trace: 'on' });
const finishTheme = page => page.waitForFunction(() => !document.documentElement.dataset.themeMotion);
async function login(page) { await page.getByLabel('Username', { exact: true }).fill('operator'); await page.getByLabel('Password', { exact: true }).fill('flowra2026'); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(page.locator('h1')).toHaveText('Overview'); }
async function capture(page, name) { await finishTheme(page); await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ animations: 'disabled', path: `test-results/appearance-motion/${name}.png`, fullPage: true }); }

test('integrated login appearance supports keyboard, outside dismissal, persistence and unclipped in-flow choices', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' }); await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: /Sign up/ })).toHaveCount(0);
  const trigger = page.getByRole('button', { name: 'Appearance settings', exact: true });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 }); await trigger.scrollIntoViewIfNeeded();
    const before = await trigger.boundingBox(); await trigger.focus(); await page.keyboard.press('ArrowDown');
    const panel = page.getByRole('region', { name: 'Login appearance choices' });
    await expect(trigger).toHaveAttribute('aria-expanded', 'true'); await expect(panel).toHaveCSS('opacity', '1');
    await expect(panel.locator('input:checked')).toBeFocused();
    const box = await panel.boundingBox(), username = await page.getByLabel('Username', { exact: true }).boundingBox();
    expect(box.bottom ?? box.y + box.height).toBeLessThanOrEqual(username.y); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect((await trigger.boundingBox()).y).toBeCloseTo(before.y, 0);
    await capture(page, `login-open-${width}-light`); await page.keyboard.press('Escape'); await expect(trigger).toBeFocused(); await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click(); await page.getByLabel('Username', { exact: true }).click(); await expect(trigger).toHaveAttribute('aria-expanded', 'false'); await expect(page.getByLabel('Username', { exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await trigger.click(); await page.getByRole('radio', { name: 'Dark', exact: true }).check(); await finishTheme(page); await page.keyboard.press('Escape'); await capture(page, 'login-320-dark');
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); await login(page);
  await page.getByRole('button', { name: 'Operator profile', exact: true }).click(); await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
});

test('theme reveal keeps both scenes opaque, includes High Contrast and respects motion and forced colors', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.themeCalls = 0; window.themeSamples = [];
    const original = document.startViewTransition?.bind(document);
    if (original) document.startViewTransition = callback => {
      window.themeCalls++; const transition = original(callback);
      transition.ready.then(async () => {
        const start = performance.now();
        while (document.documentElement.dataset.themeMotion && performance.now() - start < 260) {
          const scene = name => getComputedStyle(document.documentElement, '::view-transition-' + name + '(root)');
          window.themeSamples.push({ time: performance.now() - start, clip: scene('new').clipPath, oldOpacity: scene('old').opacity, newOpacity: scene('new').opacity });
          await new Promise(requestAnimationFrame);
        }
      }).catch(() => {});
      return transition;
    };
  });
  await page.emulateMedia({ colorScheme: 'light' }); await page.goto('/'); expect(await page.evaluate(() => window.themeCalls)).toBe(0);
  await login(page); await demoControl(page, 'Pause'); const number = await page.locator('.metric-value').first().textContent();
  await page.getByRole('button', { name: 'Operator profile', exact: true }).click(); await page.getByRole('radio', { name: 'Dark', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); await finishTheme(page);
  expect(await page.evaluate(() => window.themeCalls)).toBe(1);
  const samples = await page.evaluate(() => window.themeSamples);
  expect(new Set(samples.map(sample => sample.clip)).size).toBeGreaterThan(2);
  expect(samples.every(sample => sample.oldOpacity === '1' && sample.newOpacity === '1')).toBe(true);
  await testInfo.attach('actual-theme-animation-frames', { body: JSON.stringify(samples), contentType: 'application/json' });
  expect(await page.locator('.metric-value').first().textContent()).toBe(number);
  await page.getByRole('radio', { name: 'System', exact: true }).check(); await finishTheme(page); await page.emulateMedia({ colorScheme: 'dark' }); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); await finishTheme(page);
  const count = await page.evaluate(() => window.themeCalls);
  await page.getByRole('radio', { name: 'High contrast', exact: true }).check(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'contrast'); await finishTheme(page);
  await page.getByRole('radio', { name: 'Light', exact: true }).check(); await finishTheme(page);
  expect(await page.evaluate(() => window.themeCalls)).toBe(count + 2);
  await page.emulateMedia({ forcedColors: 'active' }); await page.getByRole('radio', { name: 'High contrast', exact: true }).check(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'contrast');
  await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'reduce' }); await page.getByRole('radio', { name: 'Light', exact: true }).check(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'light'); expect(await page.evaluate(() => window.themeCalls)).toBe(count + 2);
  await page.keyboard.press('Escape'); await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'light'); expect(await page.evaluate(() => window.themeCalls)).toBe(0);
});

test('technical accordions animate both directions at natural height with accessible hidden state and reduced motion', async ({ page }, testInfo) => {
  await page.goto('/'); await login(page); await openDemoSettings(page);
  const trigger = page.getByRole('button', { name: 'Simulation assumptions', exact: true });
  const section = page.locator('.technical-accordion').filter({ has: trigger }); const body = section.locator('.accordion-reveal');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false'); await expect(body).toHaveAttribute('inert', '');
  await trigger.scrollIntoViewIfNeeded(); await trigger.click();
  const heights = await body.evaluate(async element => { const values = [], start = performance.now(); while (performance.now() - start < 300) { values.push(element.getBoundingClientRect().height); await new Promise(requestAnimationFrame); } return values; });
  expect(heights.some(height => height > 0 && height < heights.at(-1))).toBe(true); await expect(trigger).toHaveAttribute('aria-expanded', 'true'); await expect(body).toHaveAttribute('aria-hidden', 'false');
  const lastParagraph = await body.locator('p').last().boundingBox(), bounds = await body.boundingBox(); expect(lastParagraph.y + lastParagraph.height).toBeLessThanOrEqual(bounds.y + bounds.height);
  await testInfo.attach('accordion-browser-expansion', { body: JSON.stringify(heights), contentType: 'application/json' });
  await trigger.focus(); await page.keyboard.press('Space');
  const closing = await body.evaluate(async element => { const values = [], start = performance.now(); while (performance.now() - start < 280) { values.push(element.getBoundingClientRect().height); await new Promise(requestAnimationFrame); } return values; });
  expect(closing.some(height => height > 0 && height < heights.at(-1))).toBe(true);
  await testInfo.attach('accordion-browser-collapse', { body: JSON.stringify(closing), contentType: 'application/json' });
  await expect(body).toHaveCSS('opacity', '0'); await expect(body).toHaveAttribute('inert', ''); await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: 'Detection and forecasting methodology', exact: true }).click(); await capture(page, 'technical-desktop-light');
  await page.getByRole('button', { name: 'Operator profile', exact: true }).click(); await page.getByRole('radio', { name: 'Dark', exact: true }).check(); await finishTheme(page); await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 }); await capture(page, 'technical-mobile-dark');
  await page.emulateMedia({ reducedMotion: 'reduce' }); await trigger.click(); await expect(body).toHaveCSS('transition-duration', '0s');
  await expect(page.locator('.technical-accordion')).toHaveCount(5); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('sign-out cancels an unfinished appearance snapshot before removing authenticated content', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await login(page); await page.getByRole('button', { name: 'Operator profile', exact: true }).click();
  const immediate = await page.evaluate(() => {
    document.querySelector('input[value="dark"]').click();
    [...document.querySelectorAll('button')].find(button => button.textContent === 'Sign out').click();
    return { dashboard: Boolean(document.querySelector('.app-shell')), themeSnapshot: document.documentElement.dataset.themeMotion || null };
  });
  expect(immediate).toEqual({ dashboard: false, themeSnapshot: null });
  await expect(page.getByRole('heading', { name: 'Sign in to Flowra' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.session-departure')).toHaveCount(0); await expect(page.locator('.app-shell')).toHaveCount(0); expect(errors).toEqual([]);
});

test('touch login choices and browser without View Transitions retain functional appearances', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => { document.startViewTransition = undefined; });
  try {
    const page = await context.newPage(); await page.goto('http://localhost:3100');
    const trigger = page.getByRole('button', { name: 'Appearance settings', exact: true }); await trigger.tap();
    await page.getByRole('radio', { name: 'Dark', exact: true }).tap(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByLabel('Username', { exact: true }).tap(); await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.tap(); await page.getByRole('radio', { name: 'High contrast', exact: true }).tap(); await page.keyboard.press('Escape'); await expect(page.locator('html')).toHaveAttribute('data-theme', 'contrast');
    await login(page); await expect(page.locator('html')).toHaveAttribute('data-theme', 'contrast');
  } finally { await context.close(); }
});
