import { test, expect } from './fixtures.mjs';
import { demoControl, openDemoSettings } from './demo-controls.mjs';

test('authenticated refresh initializes without ever mounting the sign-in form or losing its destination', async ({ page }) => {
  await page.getByRole('link', { name: 'Digital twin', exact: true }).click();
  await page.addInitScript(() => {
    window.signInMounted = false;
    new MutationObserver(() => { if (document.querySelector('#demo-username')) window.signInMounted = true; }).observe(document, { childList: true, subtree: true });
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Digital twin', level: 1 })).toBeVisible();
  expect(await page.evaluate(() => window.signInMounted)).toBe(false);
  const response = await page.request.get('/');
  const html = await response.text();
  expect(html).toContain('Checking demo session');
  expect(html).not.toContain('id="demo-username"');
  await page.getByRole('button', { name: 'Operator profile', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Flowra' })).toBeVisible();
});

test('visible appearance labels work after login, including native keyboard arrows, persistence and System changes', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Operator profile', exact: true });
  await trigger.click();
  const menu = page.getByRole('region', { name: 'Operator menu' });
  // Clicking the text used to blur the menu before the associated input could change.
  for (const [name, value] of [['Dark', 'dark'], ['Light', 'light'], ['High contrast', 'contrast'], ['Dark', 'dark']]) {
    await menu.locator('label').filter({ hasText: new RegExp(`^${name}$`) }).locator('span').first().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', value);
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('radio', { name, exact: true })).toBeChecked();
  }
  await page.keyboard.press('Escape'); await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await trigger.click();
  await menu.getByRole('radio', { name: 'Light', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(menu.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
  await menu.locator('label').filter({ hasText: /^System$/ }).click();
  await page.emulateMedia({ colorScheme: 'light' }); await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' }); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('avatar expands without header movement, collapses, supports focus and reduced motion', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Operator profile', exact: true });
  const label = page.locator('.profile-label');
  const before = await page.locator('.live').boundingBox();
  await expect(page.locator('.profile-surface')).toHaveCSS('width', '44px');
  await trigger.hover(); await expect(page.locator('.profile-surface')).toHaveCSS('width', '176px');
  await expect(label).toHaveCSS('opacity', '1');
  expect(await page.locator('.live').boundingBox()).toEqual(before);
  await expect(page.getByRole('tooltip', { includeHidden: true })).toHaveCount(0);
  await page.mouse.move(0, 0); await expect(page.locator('.profile-surface')).toHaveCSS('width', '44px');
  await page.keyboard.press('Tab'); await trigger.focus();
  await expect(label).toHaveCSS('opacity', '1');
  await trigger.click(); await expect(page.getByRole('region', { name: 'Operator menu' })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await trigger.evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s');
});

test('touch profile opens by tap, switches appearance by label and closes without a hover tooltip', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage(); await page.goto('http://localhost:3100');
    await page.getByLabel('Username', { exact: true }).fill('operator');
    await page.getByLabel('Password', { exact: true }).fill('flowra2026');
    await page.getByRole('button', { name: 'Sign in' }).tap();
    const trigger = page.getByRole('button', { name: 'Operator profile', exact: true });
    await trigger.tap(); await expect(page.getByRole('region', { name: 'Operator menu' })).toBeVisible();
    await expect(page.getByRole('tooltip')).toBeHidden();
    await page.getByRole('region', { name: 'Operator menu' }).locator('label').filter({ hasText: /^Dark$/ }).tap();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await trigger.tap(); await expect(page.getByRole('region', { name: 'Operator menu' })).toBeHidden();
    await expect(page.getByRole('tooltip')).toBeHidden();
    await expect(page.getByRole('tooltip', { includeHidden: true })).toHaveCount(0);
    await expect(page.locator('.profile-label')).toHaveCSS('opacity', '0');
    await page.screenshot({ path: 'test-results/polish/overview-touch-dark.png', fullPage: true });
    await page.keyboard.press('Tab'); await trigger.focus();
    await expect(page.locator('.profile-label')).toHaveCSS('opacity', '1');
    await trigger.tap(); await page.getByRole('button', { name: 'Sign out', exact: true }).tap();
    await expect(page.getByRole('heading', { name: 'Sign in to Flowra' })).toBeVisible();
    await expect(page.locator('.app-shell')).toHaveCount(0);
  } finally { await context.close(); }
});

test('settings owns demo controls, reset preserves unrelated state and connected controls remain truthful', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Select data source' })).toHaveCount(0);
  await expect(page.locator('.header-actions')).not.toContainText('How Flowra works');
  await demoControl(page, 'Pause'); await expect(page.locator('.live')).toHaveText('Demo paused');
  await demoControl(page, 'Limited supply');
  await openDemoSettings(page);
  await expect(page.getByRole('button', { name: 'Limited supply', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const theme = await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button', { name: 'Reset current scenario' }).click();
  await expect(page.locator('.sim-time')).toHaveText('T+0 min');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await page.route('**/api/telemetry', route => route.fulfill({ json: { state: null, status: 'waiting', configured: true } }));
  await page.getByRole('button', { name: 'Connected device', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Reset current scenario' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Normal operation', exact: true })).toBeDisabled();
  await expect(page.locator('.live')).toHaveText('Disconnected');
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No device readings received' })).toBeVisible();
  await expect(page.locator('.metrics')).toBeHidden();
  await demoControl(page, 'Internal simulation');
  await expect(page.locator('.live')).toHaveText('Demo paused');
  await expect(page.locator('.metric').first()).toContainText('15.8');
});

test('assistant brands generated responses and safely renders richer Markdown with frozen evidence', async ({ page }) => {
  await demoControl(page, 'Pause');
  await page.route('**/api/explain', route => {
    const snapshot = route.request().postDataJSON();
    return route.fulfill({ json: { available: true, explanation: `## Available water\nThe tank holds **${Math.round(snapshot.tank)} L**\nand supplies three zones.\n\n1) Inspect **Zone B with *care***.\n2) Compare __inlet and outlet__.\n\nUnfinished **emphasis\n\n<script>window.unsafe=true</script>\n\n\`\`\`text\n<img src=x onerror=alert(1)>\n\`\`\`` } });
  });
  await page.getByRole('link', { name: 'Ask Flowra', exact: true }).click();
  await page.getByLabel('Your question about this water network').fill('How much water is available?');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByText('Flowra Assistant', { exact: true })).toBeVisible();
  await expect(page.getByText('AI-generated response', { exact: true })).toBeVisible();
  await expect(page.locator('.answer-markdown h4')).toHaveText('Available water');
  await expect(page.locator('.answer-markdown li')).toHaveCount(2);
  await expect(page.locator('.answer-markdown')).not.toContainText('**');
  await expect(page.locator('.answer-markdown script,.answer-markdown img')).toHaveCount(0);
  expect(await page.evaluate(() => window.unsafe)).toBeUndefined();
  for (const name of ['Light', 'Dark']) {
    await page.getByRole('button', { name: 'Operator profile', exact: true }).click();
    await page.getByRole('radio', { name, exact: true }).check(); await page.keyboard.press('Escape');
    await page.screenshot({ path: `test-results/polish/assistant-${name.toLowerCase()}.png`, fullPage: true });
    await page.getByRole('link', { name: 'Overview', exact: true }).click();
    await page.screenshot({ path: `test-results/polish/overview-${name.toLowerCase()}.png`, fullPage: true });
    await openDemoSettings(page);
    await page.screenshot({ path: `test-results/polish/settings-${name.toLowerCase()}.png`, fullPage: true });
    await page.getByRole('link', { name: 'Ask Flowra', exact: true }).click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/polish/assistant-mobile-dark.png', fullPage: true });
  await openDemoSettings(page); await page.screenshot({ path: 'test-results/polish/settings-mobile-dark.png', fullPage: true });
});
