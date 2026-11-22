import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedJson, isSameOriginRequest } from '../lib/http-input.mjs';

test('browser origins match the original authority, including Next-normalized loopback addresses', () => {
  const url = 'http://localhost:3002/api/explain';
  const check = (origin, host, extra = {}, configured) => isSameOriginRequest(new Request(url, {
    headers: { origin, host, ...extra }
  }), configured);
  for (const host of ['localhost:3002', '127.0.0.1:3002', '[::1]:3002']) assert.ok(check('http://' + host, host));
  assert.equal(check('http://localhost:3002', '127.0.0.1:3002'), false);
  assert.equal(check('http://127.0.0.1:3000', '127.0.0.1:3002'), false);
  assert.equal(check('https://127.0.0.1:3002', '127.0.0.1:3002'), false);
  assert.equal(check('null', 'localhost:3002'), false);
  assert.equal(check('http://localhost:3002', 'localhost:3002', { 'sec-fetch-site': 'cross-site' }), false);
  const published = 'https://flowra.example';
  assert.ok(check(published, 'flowra.example', {}, published));
  assert.equal(check(published, 'flowra.example', { 'x-forwarded-host': 'flowra.example' }), false);
  assert.equal(check(published, 'flowra.example', {}, 'https://another.example'), false);
});

test('bounded sensor input accepts JSON and rejects incorrect MIME types and malformed bodies', async () => {
  const request = (body, type = 'application/json') => new Request('http://localhost/api/telemetry', { method: 'POST', headers: { 'Content-Type': type }, body });
  assert.deepEqual(await boundedJson(request('{"value":24}')), { value: 24 });
  await assert.rejects(boundedJson(request('{}', 'text/plain')), error => error.status === 415);
  await assert.rejects(boundedJson(request('{}', 'bad-application/json')), error => error.status === 415);
  await assert.rejects(boundedJson(request('{bad}')), error => error.status === 400);
});
test('body bounds are enforced even without Content-Length on a streamed request', async () => {
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('x'.repeat(8193))); controller.close(); } });
  const request = new Request('http://localhost/api/telemetry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: stream, duplex: 'half' });
  assert.equal(request.headers.has('content-length'), false);
  await assert.rejects(boundedJson(request), error => error.status === 413);
});
