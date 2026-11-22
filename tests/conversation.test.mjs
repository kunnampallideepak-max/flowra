import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, allocate, createSimulation } from '../lib/simulation.mjs';
import { generateExplanation, readConversation, readSnapshot } from '../lib/explanation.mjs';
import { snapshotKey, snapshotPayload } from '../lib/snapshot.mjs';

test('conversation uses bounded questions and history from one exact snapshot', () => {
  const state = createSimulation('low');
  const message = { role: 'user', text: 'How much water is available?', snapshotKey: snapshotKey(state) };
  const result = readConversation({ question: ' Why is a shortage predicted? ', conversation: [message] }, state);
  assert.equal(result.question, 'Why is a shortage predicted?');
  assert.equal(result.history[0].text, message.text);
  for (const input of [{ question: '' }, { question: 'x'.repeat(801) }, { question: 'test', conversation: Array(9).fill(message) }, { question: 'test', conversation: [{ ...message, role: 'system' }] }, { question: 'test', conversation: [{ ...message, text: 'x'.repeat(1801) }] }, { question: 'test', conversation: [{ ...message, snapshotKey: snapshotKey(advance(state)) }] }]) assert.throws(() => readConversation(input, state));
  assert.equal(readConversation({}, state), null);
});
test('captured payload stays frozen as the shared simulation advances', () => {
  const state = createSimulation(); const frozen = snapshotPayload(state);
  const before = JSON.stringify(frozen); advance(state);
  state.valves[0] = 30; state.history[0].tank = 10;
  assert.equal(JSON.stringify(frozen), before);
  assert.equal(readSnapshot(frozen).tank, frozen.tank);
  assert.throws(() => readSnapshot({ ...frozen, scenario: '__proto__' }));
});
test('Ask Flowra sends question, context, numbers, allocation and safety instructions through the existing secure transport', async () => {
  const state = advance(advance(createSimulation('leak')));
  const context = readConversation({ question: 'What should I inspect next?', conversation: [{ role: 'user', text: 'Is this a confirmed leak?', snapshotKey: snapshotKey(state) }, { role: 'assistant', text: 'A suspected leak needs inspection.', snapshotKey: snapshotKey(state) }] }, state);
  const response = await generateExplanation(state, { key: 'test-only-placeholder', conversation: context, fetcher: async (url, options) => {
    const body = JSON.parse(options.body); const data = JSON.parse(body.contents[0].parts[0].text);
    assert.equal(data.question, context.question); assert.equal(data.conversation.length, 2);
    assert.equal(data.zones[1].loss, 12); assert.equal(data.minute, state.minute);
    assert.deepEqual(data.allocation, allocate(state)); assert.ok(data.alerts.some(alert => alert.zone === 'B'));
    assert.match(body.systemInstruction.parts[0].text, /cannot execute actions/);
    assert.equal(options.headers['x-goog-api-key'], 'test-only-placeholder');
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Inspect Zone B meters: simulated imbalance is 12 L/min. This is a suspected leak.' }] } }] }) };
  } });
  assert.equal(response.available, true); assert.match(response.explanation, /12 L\/min/);
});
test('chat missing-key and failed requests are honest and do not pretend to answer via Gemini', async () => {
  const state = createSimulation('low');
  const conversation = { question: 'How much water is available?', history: [] };
  const missing = await generateExplanation(state, { conversation, fetcher: () => { throw Error('Must not call'); } });
  assert.equal(missing.available, false); assert.match(missing.message, /GEMINI_API_KEY/); assert.match(missing.explanation, /synthetic/);
  const failed = await generateExplanation(state, { key: 'test-only-placeholder', conversation, fetcher: async () => ({ ok: false }) });
  assert.equal(failed.available, false); assert.match(failed.message, /unavailable/);
});
