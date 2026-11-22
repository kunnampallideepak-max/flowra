import { chromium, test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const terms = ['Planning horizon', 'Demand coverage', 'Unmet demand'];
const shot = (page, name) => page.screenshot({ path: 'test-results/refinement/' + name + '.png', animations: 'disabled' });
async function nav(page, name) {
  await page.getByRole('navigation').getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true, level: 1 })).toBeVisible();
  await page.waitForFunction(() => !document.querySelector('.page-stage').getAnimations().length);
}
async function enterDemo(page) {
  await page.getByLabel('Username', { exact: true }).fill('operator');
  await page.getByLabel('Password', { exact: true }).fill('flowra2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
}

test('submitted field errors clear independently, preserve button position and allow form autofill', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const username = page.getByLabel('Username', { exact: true });
  const password = page.getByLabel('Password', { exact: true });
  const submit = page.getByRole('button', { name: 'Sign in', exact: true });
  const message = page.locator('#login-error');
  const formOffset = () => submit.evaluate(button => button.getBoundingClientRect().top - button.form.getBoundingClientRect().top);
  const original = await formOffset();
  await username.fill('operator');
  await username.press('Enter');
  await expect(message).toHaveText('Enter your password to continue.');
  await expect(password).toBeFocused();
  await expect(password).toHaveAttribute('aria-invalid', 'true');
  await expect(username).toHaveAttribute('aria-invalid', 'false');
  await expect(password).toHaveAccessibleDescription('Enter your password to continue.');
  await expect(page.locator('.feedback-message')).toHaveCSS('opacity', '1');
  expect(await formOffset()).toBe(original);
  await page.locator('.login-form form').evaluate(node => node.scrollIntoView({ block: 'center' }));
  await shot(page, 'sign-in-password-mobile');
  await password.fill('wrong');
  await expect(message).toBeEmpty();
  await password.press('Enter');
  await expect(message).toContainText('incorrect');
  await expect(page.locator('input[aria-invalid=true]')).toHaveCount(0);
  await username.fill('');
  await submit.click();
  await expect(message).toHaveText('Enter your username to continue.');
  await expect(username).toBeFocused();
  await expect(password).toHaveAttribute('aria-invalid', 'false');
  await password.fill('');
  await submit.click();
  await expect(message).toHaveText('Enter both your username and password to continue.');
  await expect(page.locator('input[aria-invalid=true]')).toHaveCount(2);
  await username.fill('operator');
  await expect(username).toBeFocused();
  await expect(message).toHaveText('Enter your password to continue.');
  expect(await formOffset()).toBe(original);
  // Password managers can populate the DOM without a React input event.
  await password.evaluate(input => { input.value = 'flowra2026'; });
  await submit.click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
});

test('stored palettes and the System preference resolve before client hydration', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.route('**/_next/static/**/*.js', route => route.abort());
  for (const [preference, theme] of [['contrast', 'contrast'], ['system', 'dark'], ['light', 'light'], ['dark', 'dark']]) {
    await page.evaluate(choice => localStorage.setItem('flowra-appearance', choice), preference);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('html')).toHaveAttribute('data-appearance', preference);
    await expect(page.locator('.session-loading')).toBeVisible();
    expect(await page.locator('html').getAttribute('data-theme-motion')).toBeNull();
  }
});

test('allocation definitions support hover, pinning, keyboard focus, dismissal and touch', async ({ page, browser }) => {
  await page.goto('/'); await enterDemo(page); await nav(page, 'Allocation lab');
  const group = page.getByRole('group', { name: 'Allocation definitions' });
  const first = group.getByRole('button', { name: terms[0] });
  const second = group.getByRole('button', { name: terms[1] });
  const layer = group.getByRole('tooltip');
  await group.evaluate(node => node.scrollIntoView({ block: 'center' }));
  const before = await group.boundingBox();
  const comparison = page.getByRole('heading', { name: 'Allocation comparison' });
  const comparisonTop = () => comparison.evaluate(node => node.getBoundingClientRect().top + scrollY);
  const top = await comparisonTop();
  await first.hover(); await expect(layer).toContainText('120 simulated minutes');
  expect(await comparisonTop()).toBe(top);
  const definitionBounds = await layer.boundingBox();
  expect(definitionBounds.y + definitionBounds.height).toBeLessThanOrEqual((await comparison.boundingBox()).y);
  await page.mouse.move(definitionBounds.x + 20, definitionBounds.y + definitionBounds.height / 2, { steps: 5 });
  await expect(first).toHaveAttribute('aria-expanded', 'true');
  await page.mouse.move(0, 0); await expect(layer).toHaveCount(0);
  await first.click(); await page.mouse.move(0, 0); await expect(layer).toBeVisible();
  await page.keyboard.press('Escape'); await expect(layer).toHaveCount(0);
  await expect(first).toBeFocused();
  await page.keyboard.press('Tab'); await expect(second).toBeFocused();
  await expect(second).toHaveAccessibleDescription(/share of water needs met/);
  await expect(layer).toContainText('60 of every 100 litres');
  await first.hover(); await expect(layer).toContainText('120 simulated minutes');
  await page.mouse.move(0, 0); await expect(layer).toContainText('60 of every 100 litres');
  await second.press('Space'); await second.press('Space'); await expect(layer).toHaveCount(0);
  await group.getByRole('button', { name: terms[2] }).click();
  await page.locator('.table-wrap').last().click({ position: { x: 10, y: 10 } });
  await expect(layer).toHaveCount(0);
  expect((await group.boundingBox()).height).toBe(before.height);
  await page.getByRole('button', { name: 'Operator profile' }).click();
  await page.getByRole('radio', { name: 'High contrast' }).check();
  await page.waitForFunction(() => !document.documentElement.dataset.themeMotion);
  await page.keyboard.press('Escape');
  await group.evaluate(node => node.scrollIntoView({ block: 'center' }));
  await group.getByRole('button', { name: terms[2] }).click();
  await expect(layer).toHaveCSS('opacity', '1');
  await shot(page, 'allocation-high-contrast');
  await page.emulateMedia({ forcedColors: 'active' });
  await shot(page, 'allocation-forced-colors');

  const touch = await browser.newContext({ isMobile: true, hasTouch: true, viewport: { width: 360, height: 740 } });
  try {
    const phone = await touch.newPage(); await phone.goto('http://localhost:3100'); await enterDemo(phone); await nav(phone, 'Allocation lab');
    for (const term of terms) {
      const trigger = phone.getByRole('button', { name: term, exact: true });
      await trigger.tap(); await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await expect(phone.getByRole('tooltip')).toHaveCount(1);
      await expect(phone.getByRole('tooltip')).toHaveCSS('opacity', '1');
      if (term === terms[1]) await shot(phone, 'allocation-touch');
      await trigger.tap(); await expect(phone.getByRole('tooltip')).toHaveCount(0);
    }
  } finally { await touch.close(); }
});

test('introduction keeps its controls stationary and settles on the last rapid selection', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('/'); await enterDemo(page); await nav(page, 'How Flowra works');
  const buttons = page.locator('.tour-steps button');
  await buttons.first().evaluate(node => node.scrollIntoView({ block: 'center' }));
  const position = () => buttons.first().evaluate(node => node.getBoundingClientRect().top + scrollY);
  const before = await position();
  const frames = await buttons.nth(6).evaluate(async button => {
    const frame = document.querySelector('.tour-frame');
    button.click();
    const samples = [];
    const start = performance.now();
    while (performance.now() - start < 400) {
      await new Promise(requestAnimationFrame);
      const current = frame.querySelector('[data-current=true]');
      samples.push({
        height: frame.getBoundingClientRect().height,
        content: current.getBoundingClientRect().height,
        opacity: Number(getComputedStyle(current).opacity)
      });
    }
    return samples;
  });
  expect(frames.some(sample => sample.opacity > 0 && sample.opacity < 1)).toBe(true);
  expect(new Set(frames.map(sample => sample.height)).size).toBeGreaterThan(2);
  expect(frames.every(sample => sample.content <= sample.height + 1)).toBe(true);
  await expect(page.getByRole('heading', { name: 'Try all four scenarios' })).toBeVisible();
  await page.waitForFunction(() => !document.querySelector('.tour-frame').getAnimations({ subtree: true }).length);
  expect(await position()).toBe(before);
  await shot(page, 'introduction-tablet');
  await page.evaluate(async () => {
    const steps = document.querySelectorAll('.tour-steps button');
    for (const target of [1, 4, 2, 6, 0, 3, 5]) {
      steps[target].click();
      await new Promise(requestAnimationFrame);
    }
  });
  await expect(page.getByRole('heading', { name: 'Share limited water fairly' })).toBeVisible();
  await expect(page.locator('.tour-content:not([inert])')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await buttons.nth(1).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Follow water from tank to zones' })).toBeVisible();
  expect(await page.locator('.tour-frame').evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(buttons.nth(1)).toBeFocused();
  await page.getByRole('button', { name: 'Previous step' }).click();
  await expect(page.getByRole('heading', { name: 'See the whole water network' })).toBeVisible();
  const actions = page.locator('.tour-actions');
  for (const width of [895, 600, 320]) {
    await page.setViewportSize({ width, height: 840 });
    await buttons.first().click();
    const geometry = () => actions.evaluate(node => [node.offsetTop, node.offsetHeight, node.offsetWidth]);
    const start = await geometry();
    await buttons.last().click();
    expect(await geometry()).toEqual(start);
    await expect(page.getByRole('link', { name: 'Open Demo & settings' })).toHaveAttribute('href', '#about');
    if (width === 320) await shot(page, 'introduction-mobile');
  }
});

test('Chrome desktop page zoom keeps the glossary aligned and the open definition on screen', async () => {
  test.setTimeout(60000);
  // An empty profile directory asks Playwright for a disposable profile. Change
  // Chrome's own page zoom here so both media queries and layout rounding run.
  const context = await chromium.launchPersistentContext('', {
    channel: 'chrome', headless: true, viewport: null, args: ['--window-size=1440,1000']
  });
  try {
    const settings = await context.newPage();
    await settings.goto('chrome://settings/appearance');
    const page = await context.newPage();
    const client = await context.newCDPSession(page);
    await page.goto('http://localhost:3100'); await enterDemo(page);
    await shot(page, 'overview-desktop');
    await nav(page, 'Allocation lab');
    const group = page.getByRole('group', { name: 'Allocation definitions' });
    const baseline = await page.evaluate(() => devicePixelRatio);
    for (const zoom of [1, 1.25, 1.5, 2, 3, 4]) {
      await settings.evaluate(value => chrome.settingsPrivate.setDefaultZoom(value), zoom);
      await expect.poll(() => page.evaluate(() => devicePixelRatio)).toBeCloseTo(zoom * baseline, 2);
      await group.evaluate(node => node.scrollIntoView({ block: 'center' }));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const row = await group.getByRole('button').evaluateAll(buttons => buttons.map(button => {
        const { width, top, height } = button.getBoundingClientRect(); return { width, top, height };
      }));
      for (const cell of row) {
        expect(Math.abs(cell.width - row[0].width)).toBeLessThan(1);
        expect(cell.top).toBe(row[0].top); expect(cell.height).toBe(row[0].height);
      }
      for (const term of terms) {
        const trigger = group.getByRole('button', { name: term, exact: true });
        await trigger.focus(); await trigger.press('Enter');
        const popup = group.getByRole('tooltip');
        await expect(popup).toHaveCSS('opacity', '1');
        const box = await popup.boundingBox(), anchor = await trigger.boundingBox();
        const viewport = await page.evaluate(() => ({ width: document.documentElement.clientWidth, height: innerHeight }));
        expect(box.x).toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(box.y).toBeGreaterThanOrEqual(-1);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
        expect(box.y >= anchor.y + anchor.height - 1 || box.y + box.height <= anchor.y + 1).toBe(true);
        expect(box.height).toBeGreaterThan(32);
        if (term === terms[1]) {
          // Capture the composited viewport directly. A CSS-pixel screenshot clip
          // can land outside the painted page at non-default native Chrome zoom.
          const { data } = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
          expect(data.length).toBeGreaterThan(12000);
          await writeFile('test-results/refinement/allocation-zoom-' + Math.round(zoom * 100) + '.png', Buffer.from(data, 'base64'));
        }
        await trigger.press('Escape'); await expect(popup).toHaveCount(0);
      }
    }
  } finally { await context.close(); }
});
