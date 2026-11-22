import { TelemetryError, validateTelemetry, frameToState, telemetryStatus } from './telemetry.mjs';
const slot = Symbol.for('flowra.telemetry.v1');
function store() { return globalThis[slot] ||= { state: null, snapshots: new Map(), receipts: [] }; }
export function receiveTelemetry(input, { now = Date.now(), deviceId } = {}) {
  const frame = validateTelemetry(input, { now, deviceId });
  const data = store();
  const previous = data.state;
  if (previous && (Date.parse(frame.measuredAt) <= Date.parse(previous.measuredAt) || (frame.bootId === previous.bootId && frame.sequence <= previous.sequence))) throw new TelemetryError('Duplicate or out-of-order reading. Send a newer timestamp and sequence.', 409);
  data.receipts = data.receipts.filter(at => at > now - 60000);
  if (data.receipts.length >= 30) throw new TelemetryError('Device rate limit reached. Send at most one frame every two seconds.', 429);
  if (data.receipts.length && now - data.receipts.at(-1) < 2000) throw new TelemetryError('Readings are arriving too quickly. Send at most one frame every two seconds.', 429);
  const state = frameToState(frame, previous, now);
  data.receipts.push(now); data.state = state;
  data.snapshots.set(state.telemetrySnapshotId, state);
  while (data.snapshots.size > 90) data.snapshots.delete(data.snapshots.keys().next().value);
  return state;
}
export function latestTelemetry(now = Date.now()) {
  const state = store().state;
  const freshAt = state ? Math.min(state.receivedAt, Date.parse(state.measuredAt)) : null;
  return { status: telemetryStatus(freshAt, now), state, serverTime: now };
}
export function connectedSnapshot(id) {
  if (typeof id !== 'string' || id.length > 100) throw new TelemetryError('Invalid connected snapshot.');
  const state = store().snapshots.get(id);
  if (!state) throw new TelemetryError('Connected snapshot has expired or this server restarted. Use latest snapshot and retry.');
  return state;
}
