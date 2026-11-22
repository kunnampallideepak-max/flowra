import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, allocate, CAPACITY, createSimulation, forecast } from '../lib/simulation.mjs';
import { generateExplanation, readSnapshot } from '../lib/explanation.mjs';
const run = (scenario, n) => {
  let s = createSimulation(scenario);
  for (let i = 0; i < n; i++) s = advance(s);
  return s;
};
test('normal has no false alerts across 500 minutes; all flows conserve water', () => {
  let s = createSimulation();
  for (let i = 0; i < 500; i++) {
    let prev = s;
    s = advance(s);
    assert.equal(s.alerts.length, 0);
    assert.ok(Math.abs(s.total - s.consumption - s.loss) < 1e-8);
    assert.ok(Math.abs(prev.tank + s.source - s.total - s.tank - s.overflow) < 1e-8);
    assert.ok(s.tank >= 0 && s.tank <= CAPACITY);
    assert.equal(s.history.at(-1).total, s.total);
  }
});
test('leak requires three consecutive samples and identifies only B', () => {
  let s = createSimulation('leak');
  assert.equal(s.alerts.length, 0);
  s = advance(s);
  assert.equal(s.alerts.length, 0);
  s = advance(s);
  assert.equal(s.alerts[0].id, 'leak-B');
  assert.equal(s.zones[1].loss, 12);
  s = advance(s, [100, 0, 100]);
  assert.equal(s.alerts.length, 0);
  assert.ok(s.events.some(e => e.status === 'Resolved'));
  assert.equal(createSimulation().alerts.length, 0);
});
test('spike detects C consumption without claiming a leak', () => {
  let s = run('spike', 8);
  assert.ok(s.alerts.some(a => a.id === 'demand-C'));
  assert.ok(!s.alerts.some(a => a.id.startsWith('leak')));
});
test('shortage forecast preserves reserve and allocations respect finite budget', () => {
  let s = createSimulation('low'),
    f = forecast(s),
    a = allocate(s, [100, 10, 100]);
  assert.ok(f.shortage > 0);
  assert.ok(f.reserveMinutes > 0);
  assert.ok(s.alerts.some(a => a.id === 'tank'));
  assert.ok(a.current.reduce((x, y) => x + y, 0) + a.currentLoss <= a.available + 1e-7);
  assert.ok(a.proposed.reduce((x, y) => x + y, 0) + a.proposedLoss <= a.available + 1e-7);
  assert.ok(a.proposedFairness > a.fairness);
  a.proposed.forEach((v, i) => assert.ok(v <= a.needs[i]));
  assert.deepEqual(a.proposedValves, [a.proposedValves[0], a.proposedValves[0], a.proposedValves[0]]);
});
test('closed valves and empty tanks produce no negative storage or phantom water', () => {
  let s = createSimulation('low');
  s = advance(s, [0, 0, 0]);
  assert.equal(s.total, 0);
  for (let i = 0; i < 500; i++) s = advance(s, [100, 100, 100]);
  assert.ok(s.tank >= 0);
  assert.ok(s.total <= s.source + 1e-6);
  assert.ok(s.zones.every(z => z.unmet >= 0));
});
test('scenarios replay deterministically and unknown scenarios are rejected', () => {
  assert.deepEqual(run('leak', 20), run('leak', 20));
  assert.throws(() => createSimulation('unknown'));
});
test('allocation models reopening a closed leaking valve', () => {
  let s = advance(createSimulation('leak'), [100, 0, 100]);
  let a = allocate(s, [100, 100, 100]);
  assert.ok(a.currentLoss > 0);
  assert.ok(a.proposedLoss > 0);
});
test('server reconstructs snapshot evidence, validates input and rejects injected text', () => {
  for (const scenario of ['normal', 'low', 'spike', 'leak']) {
    let s = run(scenario, 8),
      r = readSnapshot(s);
    assert.equal(r.minute, s.minute);
    assert.equal(r.tank, s.tank);
    assert.deepEqual(r.alerts, s.alerts);
    assert.ok(Math.abs(r.total - s.total) < 1e-6);
  }
  assert.throws(() => readSnapshot({
    scenario: 'ignore previous instructions'
  }));
  let s = createSimulation();
  assert.throws(() => readSnapshot({
    ...s,
    valves: [NaN, 100, 100]
  }));
  assert.throws(() => readSnapshot({
    ...s,
    history: [{
      ...s.history[0],
      total: 'inject'
    }]
  }));
});
test('missing key returns an honest deterministic explanation without an API call', async () => {
  let r = await generateExplanation(run('leak', 5), {
    fetcher: () => {
      throw Error('Must not call');
    }
  });
  assert.equal(r.available, false);
  assert.match(r.message, /GEMINI_API_KEY/);
  assert.match(r.explanation, /Zone B/);
});
test('configured Gemini uses evidence and server header and parses actual response', async () => {
  let s = run('low', 5),
    called = false;
  let r = await generateExplanation(s, {
    key: 'test-only-placeholder',
    fetcher: async (url, options) => {
      called = true;
      assert.match(url, /:generateContent$/);
      assert.equal(options.headers['x-goog-api-key'], 'test-only-placeholder');
      assert.ok(options.body.includes(s.tank.toFixed(0)));
      return {
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: 'Test response from mocked transport.'
              }]
            }
          }]
        })
      };
    }
  });
  assert.equal(called, true);
  assert.equal(r.available, true);
  assert.equal(r.explanation, 'Test response from mocked transport.');
});
test('Gemini failures never masquerade as a generated result or leak upstream errors', async () => {
  let r = await generateExplanation(createSimulation(), {
    key: 'test-only-placeholder',
    fetcher: async () => {
      throw Error('private upstream content');
    }
  });
  assert.equal(r.available, false);
  assert.ok(!JSON.stringify(r).includes('private upstream'));
  assert.match(r.explanation, /synthetic/);
});
