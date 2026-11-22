import test from 'node:test';
import assert from 'node:assert/strict';
import { exampleFrame } from '../lib/telemetry-example.mjs';
import { validateTelemetry, frameToState, telemetryStatus, STALE_MS, DISCONNECTED_MS } from '../lib/telemetry.mjs';
import { receiveTelemetry, latestTelemetry } from '../lib/telemetry-store.mjs';
import { validIngestToken } from '../lib/ingest-auth.mjs';
import { readSnapshot, readConversation } from '../lib/explanation.mjs';
import { snapshotKey, snapshotPayload } from '../lib/snapshot.mjs';
import { validDemoLogin } from '../lib/demo-access.mjs';
const now = Date.UTC(2026, 10, 21, 12);

test('demo credentials are functional but separate from device authentication', () => {
  assert.equal(validDemoLogin('operator', 'flowra2026'), true);
  assert.equal(validDemoLogin('operator', 'wrong'), false);
  const token = 'test-only-ingestion-token-1234567890abcdef';
  assert.equal(validIngestToken(`Bearer ${token}`, token), true);
  for (const header of [null, 'Bearer flowra2026', 'operator', `Basic ${token}`, 'Bearer wrong']) assert.equal(validIngestToken(header, token), false);
  assert.equal(validIngestToken('Bearer flowra2026', 'flowra2026'), false);
});
test('complete received frames enforce sensor IDs, units, bounded values and timestamps', () => {
  assert.equal(validateTelemetry(exampleFrame({ now }), { now }).zones.length, 3);
  const mutations = [frame => { frame.deviceId = 'unknown'; }, frame => { frame.source = 'physical'; }, frame => { frame.tank.unit = 'L'; }, frame => { frame.tank.levelPercent = 101; }, frame => { frame.sourceFlow.flow = NaN; }, frame => { frame.zones[0].unit = 'gallons'; }, frame => { frame.zones[0].inletSensorId = 'unknown'; }, frame => { frame.zones.pop(); }, frame => { frame.zones[1] = frame.zones[0]; }, frame => { frame.zones[0].outlet = 501; }, frame => { frame.zones[0].outlet = 25; }, frame => { frame.measuredAt = new Date(now - 31000).toISOString(); }, frame => { frame.measuredAt = new Date(now + 11000).toISOString(); }, frame => { frame.extra = true; }];
  for (const mutate of mutations) { const frame = exampleFrame({ now }); mutate(frame); assert.throws(() => validateTelemetry(frame, { now })); }
});
test('freshness status uses receipt time and never manufactures a reading', () => {
  assert.equal(telemetryStatus(null, now), 'waiting');
  assert.equal(telemetryStatus(now, now), 'live');
  assert.equal(telemetryStatus(now, now + STALE_MS), 'stale');
  assert.equal(telemetryStatus(now, now + DISCONNECTED_MS), 'disconnected');
});
test('received data uses shared rules, exact readings and a real elapsed-minute chart', () => {
  let state = null;
  for (let index = 0; index < 3; index++) state = frameToState(exampleFrame({ scenario: 'leak', sequence: index, now: now + index * 5000 }), state, now + index * 5000);
  assert.equal(state.zones[1].loss, 12); assert.equal(state.tank, 15600);
  assert.ok(state.alerts.some(alert => alert.id === 'leak-B')); assert.equal(state.history.length, 3);
  assert.equal(state.minute, 10 / 60); assert.ok(Math.abs(state.total - state.consumption - state.loss) < 1e-8);
  const resumed = frameToState(exampleFrame({ scenario: 'leak', sequence: 3, now: now + 40000 }), state, now + 40000);
  assert.equal(resumed.streaks[1], 1); assert.equal(resumed.history.length, 1);
  assert.equal(frameToState(exampleFrame({ scenario: 'spike', now })).alerts[0].id, 'demand-C');
  assert.equal(frameToState(exampleFrame({ scenario: 'low', now })).alerts[0].id, 'tank');
});
test('server storage rejects replay, ordering and rate violations; connected AI snapshots use server evidence', () => {
  const first = receiveTelemetry(exampleFrame({ now }), { now });
  assert.equal(latestTelemetry(now).status, 'live');
  assert.throws(() => receiveTelemetry(exampleFrame({ now }), { now }), /Duplicate/);
  assert.throws(() => receiveTelemetry(exampleFrame({ now: now + 1000, sequence: 1 }), { now: now + 1000 }), /quickly/);
  const next = receiveTelemetry(exampleFrame({ now: now + 5000, sequence: 1, scenario: 'leak' }), { now: now + 5000 });
  const payload = snapshotPayload(first);
  const frozen = readSnapshot({ ...payload, tank: 0 });
  assert.equal(frozen.tank, first.tank); // Browser tampering cannot replace server-recorded evidence.
  assert.notEqual(snapshotKey(first), snapshotKey(next));
  assert.throws(() => readConversation({ question: 'Why?', conversation: [{ role: 'user', text: 'earlier', snapshotKey: snapshotKey(next) }] }, frozen));
  assert.equal(latestTelemetry(now + 5000 + DISCONNECTED_MS).status, 'disconnected');
  assert.throws(() => readSnapshot({ sourceMode: 'connected', telemetrySnapshotId: 'unknown' }));
  receiveTelemetry(exampleFrame({ now: now + 60000, sequence: 2 }), { now: now + 80000 });
  assert.equal(latestTelemetry(now + 80000).status, 'stale');
});
