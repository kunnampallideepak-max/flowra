import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../app/api/explain/route.js';
import { createSimulation, explain } from '../lib/simulation.mjs';
import { readSnapshot } from '../lib/explanation.mjs';

test('the per-process explanation budget limits provider calls and keeps the submitted snapshot fallback', async t => {
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'unit-test-only';
  t.after(() => {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  });
  const provider = t.mock.method(globalThis, 'fetch', async () => Response.json({
    candidates: [{ content: { parts: [{ text: 'Test explanation' }] } }]
  }));
  const snapshot = createSimulation();
  const post = () => POST(new Request('http://localhost/api/explain', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(snapshot)
  }));
  for (let i = 0; i < 10; i++) assert.equal((await post()).status, 200);
  const limited = await post();
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).explanation, explain(readSnapshot(snapshot)));
  assert.equal(provider.mock.callCount(), 10);
});
