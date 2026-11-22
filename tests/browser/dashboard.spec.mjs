import { demoControl } from './demo-controls.mjs';
import { test, expect } from './fixtures.mjs';
import { createSimulation } from '../../lib/simulation.mjs';
test('operator walkthrough: scenarios, twin, allocation, export and fallback', async ({
  page
}) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', {
    name: 'Overview',
    exact: true
  })).toBeVisible();
  await demoControl(page, 'Suspected leak');
  await expect(page.getByText('Suspected leak · Zone B', {
    exact: false
  }).first()).toBeVisible({
    timeout: 12000
  });
  await page.getByText('Suspected leak · Zone B', {
    exact: false
  }).first().click();
  await expect(page.getByText(/Exceeds max\(3 L\/min/).first()).toBeVisible();
  await demoControl(page, 'Pause');
  await page.getByRole('link', {
    name: 'Digital twin',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: 'Inspect B',
    exact: true
  }).click();
  await expect(page.getByText('Zone B · Community center', {
    exact: true
  })).toBeVisible();
  await demoControl(page, 'Normal operation');
  await expect(page.getByText(/Everything is flowing/)).toBeVisible();
  await demoControl(page, 'Demand spike');
  await expect(page.getByText('Unusual consumption · Zone C', {
    exact: false
  })).toBeVisible();
  await demoControl(page, 'Limited supply');
  await expect(page.getByText('Low central tank', {
    exact: false
  })).toBeVisible();
  await page.getByRole('link', {
    name: 'Allocation lab',
    exact: true
  }).click();
  await page.getByLabel('Zone B · Community center').fill('10');
  await expect(page.getByText('10%', {
    exact: true
  })).toBeVisible();
  await page.getByRole('button', {
    name: 'Load fair plan',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: 'Apply virtual valves',
    exact: true
  }).click();
  await expect(page.getByRole('status')).toContainText('Virtual valves applied');
  await page.getByRole('link', {
    name: 'Digital twin',
    exact: true
  }).click();
  await expect(page.getByText('Low central tank', {
    exact: false
  })).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', {
    name: 'Export snapshot',
    exact: false
  }).click();
  expect((await downloading).suggestedFilename()).toMatch(/flowra-low-\d+.json/);
  await page.getByRole('link', {
    name: 'Analysis & alerts',
    exact: true
  }).click();
  await expect(page.getByRole('heading', {
    name: 'Observed synthetic sensors'
  })).toBeVisible();
  const status = await page.request.post('/api/explain', {
    data: createSimulation()
  });
  const body = await status.json();
  if (!body.available && body.message?.includes('GEMINI_API_KEY')) {
    expect(status.status()).toBe(503);
    expect(body.errorCode).toBe('NOT_CONFIGURED');
    await page.getByRole('button', {
      name: 'Explain this snapshot'
    }).click();
    await expect(page.getByText('AI explanation unavailable', {
      exact: true
    })).toBeVisible();
    await expect(page.getByText(/Rules-based fallback/)).toBeVisible();
  }
  await page.getByRole('link', {
    name: 'Demo & settings',
    exact: true
  }).click();
  await expect(page.locator('.technical-notes')).toContainText('All example readings are synthetic.');
  expect(errors).toEqual([]);
});
test('mobile panels fit viewport and controls remain usable', async ({
  page
}) => {
  await page.setViewportSize({
    width: 390,
    height: 844
  });
  await page.goto('/');
  for (const [hash, heading] of [['overview', 'Overview'], ['network', 'Digital twin'], ['analysis', 'Analysis & alerts'], ['allocation', 'Allocation lab'], ['ask', 'Ask Flowra'], ['learn', 'How Flowra works'], ['about', 'Demo & settings']]) {
    await page.goto('/#' + hash);
    await expect(page.getByRole('heading', {
      name: heading,
      exact: true, level: 1
    })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.screenshot({
    path: 'test-results/flowra-mobile.png',
    fullPage: true
  });
});
test('snapshot endpoint validates input and rejects cross-origin requests', async ({
  request
}) => {
  let r = await request.post('/api/explain', {
    data: {
      bad: true
    }
  });
  expect(r.status()).toBe(400);
  r = await request.post('/api/explain', {
    data: createSimulation(),
    headers: {
      origin: 'https://unrelated.example'
    }
  });
  expect(r.status()).toBe(403);
  r = await request.post('/api/explain', {
    data: {
      padding: 'x'.repeat(41000)
    }
  });
  expect(r.status()).toBe(413);
});
