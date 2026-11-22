import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation } from '../lib/simulation.mjs';
import { generateExplanation } from '../lib/explanation.mjs';
import { failure, providerFailure, timeoutSetting, transportFailure } from '../lib/gemini-diagnostics.mjs';

test('pinned alternative uses the verified request profile and preserves grounded Ask Flowra parsing', async () => {
  const state = createSimulation();
  const result = await generateExplanation(state, {
    key: 'test-only-placeholder', model: 'gemini-3.5-flash-lite', logger() {},
    conversation: { question: 'How much water is stored?', history: [] },
    fetcher: async (url, options) => {
      assert.ok(url.endsWith('/gemini-3.5-flash-lite:generateContent'));
      const payload = JSON.parse(options.body);
      assert.equal(Object.hasOwn(payload.generationConfig, 'temperature'), false);
      assert.equal(JSON.parse(payload.contents[0].parts[0].text).question, 'How much water is stored?');
      assert.match(payload.systemInstruction.parts[0].text, /cannot execute actions/);
      return { ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: `The simulated tank holds ${state.tank.toFixed(0)} L.` }] } }] }) };
    }
  });
  assert.equal(result.available, true);
  assert.equal(result.model, 'gemini-3.5-flash-lite');
  assert.match(result.explanation, /simulated tank holds/);
});

test('provider errors use distinct fixed messages, never upstream text or credentials', () => {
  for (const [status, body, expected] of [
    [400, { error: { details: [{ reason: 'API_KEY_INVALID' }] } }, 'INVALID_API_KEY'],
    [400, { error: { message: 'API key not valid: private-value' } }, 'INVALID_API_KEY'],
    [401, {}, 'INVALID_API_KEY'], [403, {}, 'PERMISSION_DENIED'], [404, {}, 'MODEL_NOT_FOUND'],
    [429, {}, 'QUOTA_EXCEEDED'], [402, {}, 'BILLING_REQUIRED'], [400, {}, 'REQUEST_REJECTED'], [503, {}, 'PROVIDER_UNAVAILABLE']
  ]) {
    const result = providerFailure(status, body);
    assert.equal(result.errorCode, expected); assert.equal(result.available, false);
    assert.ok(!JSON.stringify(result).includes('private-value'));
  }
});
test('network, TLS, timeout and configuration errors are safe and distinguishable', () => {
  assert.equal(transportFailure({ name: 'TimeoutError' }).errorCode, 'TIMEOUT');
  assert.equal(transportFailure({ cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } }).errorCode, 'TIMEOUT');
  assert.equal(transportFailure({ cause: { code: 'ENOTFOUND' } }).errorCode, 'NETWORK_ERROR');
  assert.equal(transportFailure({ cause: { code: 'SELF_SIGNED_CERT_IN_CHAIN' } }).errorCode, 'TLS_ERROR');
  assert.equal(timeoutSetting(undefined), 60000); assert.equal(timeoutSetting('25000'), 25000);
  for (const value of [-1, 'abc', 999, 120001, Infinity]) assert.equal(timeoutSetting(value), 60000);
  assert.equal(failure('unknown').errorCode, 'INVALID_RESPONSE');
});
test('non-OK Gemini response preserves deterministic evidence and propagates safe HTTP failure', async () => {
  const records = [];
  const result = await generateExplanation(createSimulation(), { key: 'private-test-value', logger: record => records.push(record), fetcher: async () => ({ ok: false, status: 429, json: async () => ({ error: { message: 'private-test-value operator-personal-text', status: 'RESOURCE_EXHAUSTED' } }) }) });
  assert.equal(result.errorCode, 'QUOTA_EXCEEDED'); assert.equal(result.httpStatus, 429);
  assert.match(result.explanation, /^At T\+0 min,/);
  assert.equal(records[0].upstreamStatus, 429); assert.equal(records[0].keyPresent, true);
  assert.ok(!JSON.stringify({ result, records }).includes('private-test-value'));
  assert.ok(!JSON.stringify({ result, records }).includes('operator-personal-text'));
});
test('timeout returns 504 and never retries generation automatically', async () => {
  let calls = 0;
  const result = await generateExplanation(createSimulation(), { key: 'test-only-placeholder', logger() {}, fetcher: async () => { calls++; throw new DOMException('private error text', 'TimeoutError'); } });
  assert.equal(calls, 1); assert.equal(result.httpStatus, 504); assert.equal(result.errorCode, 'TIMEOUT');
});
test('invalid, empty, blocked, thought-only and output-limited responses do not become fake answers', async () => {
  for (const [body, expected] of [
    [{}, 'INVALID_RESPONSE'], [null, 'INVALID_RESPONSE'],
    [{ candidates: [{ content: { parts: [{ text: { secret: 'private' } }] } }] }, 'INVALID_RESPONSE'],
    [{ promptFeedback: { blockReason: 'SAFETY' } }, 'CONTENT_BLOCKED'],
    [{ candidates: [{ finishReason: 'SAFETY', content: { parts: [{ text: 'blocked text' }] } }] }, 'CONTENT_BLOCKED'],
    [{ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ thought: true, text: 'internal reasoning' }] } }] }, 'OUTPUT_LIMIT']
  ]) {
    const result = await generateExplanation(createSimulation(), { key: 'test-only-placeholder', logger() {}, fetcher: async () => ({ ok: true, status: 200, json: async () => body }) });
    assert.equal(result.available, false); assert.equal(result.errorCode, expected); assert.match(result.explanation, /synthetic/);
  }
  const result = await generateExplanation(createSimulation(), { key: 'test-only-placeholder', logger() {}, fetcher: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('private body'); } }) });
  assert.equal(result.errorCode, 'INVALID_RESPONSE');
});
test('missing key does not call Google; successful responses expose only allowlisted diagnostics', async () => {
  const missing = await generateExplanation(createSimulation(), { key: '  ', logger() {}, fetcher: () => assert.fail('No request allowed') });
  assert.equal(missing.errorCode, 'NOT_CONFIGURED'); assert.equal(missing.httpStatus, 503);
  const records = [];
  const result = await generateExplanation(createSimulation(), { key: ' test-only-placeholder ', logger: record => records.push(record), conversation: { question: 'personal question never logged', history: [] }, fetcher: async (url, options) => {
    assert.equal(options.headers['x-goog-api-key'], 'test-only-placeholder');
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ thought: true, text: 'private reasoning' }, { text: 'Actual test transport answer.' }] } }] }) };
  } });
  assert.equal(result.available, true); assert.equal(result.explanation, 'Actual test transport answer.');
  assert.deepEqual(Object.keys(records[0]).sort(), ['available', 'elapsedMs', 'errorCode', 'keyPresent', 'model', 'timeoutMs', 'upstreamStatus'].sort());
  assert.ok(!JSON.stringify(records).includes('personal')); assert.ok(!JSON.stringify(records).includes('reasoning'));
});
