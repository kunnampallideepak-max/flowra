import { demoControl, openDemoSettings } from './demo-controls.mjs';
import { test, expect } from './fixtures.mjs';
import { exampleFrame } from '../../lib/telemetry-example.mjs';
const token = 'test-only-ingestion-token-1234567890abcdef';
const headers = { Authorization: `Bearer ${token}` };
test('authenticated real HTTP ingestion, source switching, sensors, shared alerts and retained simulation', async ({ page, request }) => {
  await demoControl(page, 'Pause');
  await demoControl(page, 'Connected device', true);
  await page.locator('.sidebar nav a[href="#overview"]').click(); await expect(page.getByRole('heading', { name: 'No device readings received' })).toBeVisible(); await openDemoSettings(page);
  await expect(page.getByRole('button', { name: 'Suspected leak', exact: true })).toBeDisabled();
  const bootId = `browser-${Date.now()}`;
  let response = await request.post('/api/telemetry', { data: exampleFrame({ bootId }) }); expect(response.status()).toBe(401);
  response = await request.post('/api/telemetry', { headers: { Authorization: 'Bearer flowra2026' }, data: exampleFrame({ bootId }) }); expect(response.status()).toBe(401);
  response = await request.post('/api/telemetry', { headers, data: { ...exampleFrame({ bootId }), deviceId: 'unknown' } }); expect(response.status()).toBe(400);
  response = await request.post('/api/telemetry', { headers, data: 'not JSON' }); expect(response.status()).toBe(415);
  response = await request.post('/api/telemetry', { headers, data: { padding: 'x'.repeat(9000) } }); expect(response.status()).toBe(413);
  let lastFrame;
  for (let sequence = 0; sequence < 3; sequence++) {
    if (sequence) await new Promise(resolve => setTimeout(resolve, 2100));
    lastFrame = exampleFrame({ bootId, sequence, scenario: 'leak' });
    response = await request.post('/api/telemetry', { headers, data: lastFrame }); expect(response.status()).toBe(202);
    expect(JSON.stringify(await response.json())).not.toContain(token);
  }
  response = await request.post('/api/telemetry', { headers, data: lastFrame }); expect(response.status()).toBe(409);
  const dto = await (await request.get('/api/telemetry')).json();
  expect(dto.status).toBe('live'); expect(dto.state.zones[1].inflow).toBe(33.6); expect(dto.state.alerts[0].zone).toBe('B');
  const explanation = await request.post('/api/explain', { data: { sourceMode: 'connected', telemetrySnapshotId: dto.state.telemetrySnapshotId, tank: 0, question: 'Why is Zone B flagged?' } });
  expect(explanation.status()).toBe(503); // Test server disables Gemini; no provider call is made.
  const evidence = await explanation.json();
  expect(evidence.errorCode).toBe('NOT_CONFIGURED');
  expect(evidence.explanation).toContain('15600 L'); // Uses the server frame, not the forged browser tank value.
  expect(evidence.explanation).toContain('Zone B');
  await expect(page.getByText('Receiving readings', { exact: true })).toBeVisible();
  await expect(page.getByText(/Suspected leak.*Zone B/).first()).toBeVisible();
  await page.getByRole('link', { name: 'Digital twin', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect B', exact: true }).click();
  await expect(page.getByTestId('zone-inlet')).toHaveText('33.6 L/min');
  await expect(page.getByRole('button', { name: 'Apply virtual valves', exact: true })).toBeDisabled();
  await page.getByRole('link', { name: 'Allocation lab', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Apply virtual valves', exact: true })).toBeDisabled();
  await demoControl(page, 'Internal simulation');
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByText('Everything is flowing.', { exact: true })).toBeVisible();
  await openDemoSettings(page); await expect(page.getByRole('button', { name: 'Suspected leak', exact: true })).toBeEnabled();
});

test('stale, disconnected and unreachable feeds remain labeled without fake updates', async ({ page }) => {
  const { frameToState } = await import('../../lib/telemetry.mjs');
  const state = frameToState(exampleFrame()); let phase = 'stale';
  await page.route('**/api/telemetry', route => phase === 'unreachable' ? route.abort() : route.fulfill({ json: { state, status: phase, configured: true } }));
  await demoControl(page, 'Connected device', true);
  await expect(page.getByText('Stale readings', { exact: true })).toBeVisible();
  await page.locator('.sidebar nav a[href="#overview"]').click(); await expect(page.getByText('Alerts at last reading', { exact: true })).toBeVisible(); await openDemoSettings(page);
  phase = 'disconnected';
  await expect(page.getByText('Device disconnected', { exact: true })).toBeVisible();
  phase = 'unreachable';
  await expect(page.getByRole('alert').filter({ hasText: 'Telemetry server is unreachable' })).toBeVisible();
  await page.locator('.sidebar nav a[href="#overview"]').click();
  await expect(page.locator('.metric').filter({ hasText: 'Central tank level' }).locator('.metric-value')).toContainText('78');
  await page.setViewportSize({ width: 320, height: 568 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Ask Flowra renders safe Markdown and stays frozen across data sources', async ({ page }) => {
  await page.route('**/api/explain', async route => {
    const data = route.request().postDataJSON();
    await route.fulfill({ json: { available: true, explanation: `**Tank evidence:** ${Math.round(data.tank)} L\n\n- Inspect the **Zone B** meters.\n- No physical actions were executed.\n\n<script>window.injected=true</script>` } });
  });
  await page.getByRole('link', { name: 'Ask Flowra', exact: true }).click();
  await page.getByLabel('Your question about this water network').fill('What should I inspect?');
  await page.getByRole('button', { name: 'Send question', exact: true }).click();
  await expect(page.locator('.answer-markdown strong', { hasText: 'Tank evidence:' })).toBeVisible();
  await expect(page.locator('.answer-markdown li')).toHaveCount(2);
  await expect(page.locator('.answer-markdown')).not.toContainText('**');
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await expect(page.locator('.answer-markdown')).toContainText('<script>');
  const { frameToState } = await import('../../lib/telemetry.mjs');
  const state = frameToState(exampleFrame());
  await page.route('**/api/telemetry', route => route.fulfill({ json: { state, status: 'live', configured: true } }));
  await demoControl(page, 'Connected device');
  await expect(page.getByText(/The live network has changed/)).toBeVisible();
  await expect(page.getByText('Flowra Assistant', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Use latest snapshot', exact: true }).click();
  await page.getByLabel('Your question about this water network').fill('How much water is available?');
  await page.getByRole('button', { name: 'Send question', exact: true }).click();
  await expect(page.locator('.answer small')).toContainText(state.sourceLabel);
  await expect(page.locator('.snapshot-evidence')).toContainText('15,600 L');
});
