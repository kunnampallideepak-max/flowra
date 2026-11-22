import { ZONES, CAPACITY } from './simulation.mjs';
import { detectReadings } from './detection.mjs';
export const STALE_MS = 15000;
export const DISCONNECTED_MS = 45000;
export const TELEMETRY_SOURCE = 'connected-simulated-esp32';
export const SOURCE_LABEL = 'Connected simulated ESP32';
export class TelemetryError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = message => { throw new TelemetryError(message); };
function shape(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))) fail('Payload fields do not match the documented telemetry schema.');
}
const range = (value, max) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
export function validateTelemetry(input, { now = Date.now(), deviceId = 'esp32-flowra-01' } = {}) {
  shape(input, ['schemaVersion', 'deviceId', 'source', 'bootId', 'sequence', 'measuredAt', 'tank', 'sourceFlow', 'zones']);
  if (input.schemaVersion !== 1 || input.deviceId !== deviceId || ![TELEMETRY_SOURCE, 'http-test-sender'].includes(input.source)) fail('Unknown schema version, device identifier or source. Only configured synthetic demo sources are accepted.');
  if (typeof input.bootId !== 'string' || !/^[a-zA-Z0-9-]{8,40}$/.test(input.bootId) || !Number.isSafeInteger(input.sequence) || input.sequence < 0) fail('Invalid boot identifier or sequence.');
  if (typeof input.measuredAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(input.measuredAt)) fail('measuredAt must be a UTC ISO timestamp.');
  const measured = Date.parse(input.measuredAt);
  if (!Number.isFinite(measured) || measured < now - 30000 || measured > now + 10000) fail('Reading timestamp is too old or in the future. Synchronize the device clock.');
  shape(input.tank, ['sensorId', 'levelPercent', 'unit']);
  shape(input.sourceFlow, ['sensorId', 'flow', 'unit']);
  if (input.tank.sensorId !== 'tank-01' || input.tank.unit !== '%' || !range(input.tank.levelPercent, 100)) fail('Tank reading must use tank-01, percent units and a value from 0 to 100.');
  if (input.sourceFlow.sensorId !== 'source-01' || input.sourceFlow.unit !== 'L/min' || !range(input.sourceFlow.flow, 500)) fail('Source reading must use source-01 and L/min from 0 to 500.');
  if (!Array.isArray(input.zones) || input.zones.length !== 3) fail('A complete frame must contain Zones A, B and C.');
  const zones = ZONES.map(zone => {
    const matches = input.zones.filter(row => row?.zoneId === zone.id);
    if (matches.length !== 1) fail('Each known zone must appear exactly once.');
    const row = matches[0];
    shape(row, ['zoneId', 'inletSensorId', 'outletSensorId', 'inlet', 'outlet', 'demand', 'valvePercent', 'unit']);
    if (row.inletSensorId !== `flow-${zone.id}-in` || row.outletSensorId !== `flow-${zone.id}-out` || row.unit !== 'L/min') fail('Unknown zone sensor identifier or flow unit.');
    if (![row.inlet, row.outlet, row.demand].every(value => range(value, 500)) || !range(row.valvePercent, 100) || row.outlet > row.inlet) fail('Invalid zone flow, demand or valve value. Outlet cannot exceed inlet in this demo schema.');
    return { ...row };
  });
  return { ...input, tank: { ...input.tank }, sourceFlow: { ...input.sourceFlow }, zones };
}
export function telemetryStatus(receivedAt, now = Date.now()) {
  if (receivedAt === null || receivedAt === undefined) return 'waiting';
  const age = Math.max(0, now - receivedAt);
  return age >= DISCONNECTED_MS ? 'disconnected' : age >= STALE_MS ? 'stale' : 'live';
}
export function frameToState(frame, previous = null, receivedAt = Date.now()) {
  const measured = Date.parse(frame.measuredAt);
  const continuous = previous && receivedAt - previous.receivedAt < STALE_MS && measured - Date.parse(previous.measuredAt) < STALE_MS && frame.bootId === previous.bootId;
  const startedAt = continuous ? previous.startedAt : measured;
  const minute = (measured - startedAt) / 60000;
  const tank = frame.tank.levelPercent / 100 * CAPACITY;
  const zones = ZONES.map(config => {
    const row = frame.zones.find(item => item.zoneId === config.id);
    return { ...config, demand: row.demand, inflow: row.inlet, outflow: row.outlet, loss: row.inlet - row.outlet, valve: row.valvePercent, unmet: Math.max(0, row.demand - row.outlet) };
  });
  const { alerts, streaks } = detectReadings(zones, tank, continuous ? previous.streaks : [0, 0, 0]);
  const sample = { minute, tank, level: frame.tank.levelPercent, source: frame.sourceFlow.flow, total: zones.reduce((sum, zone) => sum + zone.inflow, 0), consumption: zones.reduce((sum, zone) => sum + zone.outflow, 0), loss: zones.reduce((sum, zone) => sum + zone.loss, 0), demand: zones.reduce((sum, zone) => sum + zone.demand, 0) };
  const events = [...(previous?.events || [])];
  alerts.forEach(alert => { if (!previous?.alerts.some(old => old.id === alert.id)) events.push({ ...alert, minute, status: 'Opened' }); });
  previous?.alerts.forEach(alert => { if (!alerts.some(next => next.id === alert.id)) events.push({ ...alert, minute, status: 'Resolved' }); });
  return { ...sample, scenario: 'connected', sourceMode: 'connected', sourceLabel: frame.source === 'http-test-sender' ? 'Connected HTTP test sender (simulated)' : SOURCE_LABEL, deviceId: frame.deviceId, bootId: frame.bootId, sequence: frame.sequence, measuredAt: frame.measuredAt, receivedAt, startedAt, telemetrySnapshotId: `${frame.bootId}:${frame.sequence}:${receivedAt}`, zones, valves: zones.map(zone => zone.valve), alerts, streaks, history: [...(continuous ? previous.history : []), sample].slice(-90), events: events.slice(-100), overflow: null };
}
