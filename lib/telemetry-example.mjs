// Test/sender fixture, never used to populate Connected mode inside the app.
export function exampleFrame({ scenario = 'normal', sequence = 0, bootId = 'node-demo-0001', now = Date.now(), deviceId = 'esp32-flowra-01', source = 'http-test-sender' } = {}) {
  const base = [24, 21.6, 14.4];
  return { schemaVersion: 1, deviceId, source, bootId, sequence, measuredAt: new Date(now).toISOString(), tank: { sensorId: 'tank-01', levelPercent: scenario === 'low' ? 16 : 78, unit: '%' }, sourceFlow: { sensorId: 'source-01', flow: scenario === 'low' ? 15 : 68, unit: 'L/min' }, zones: ['A', 'B', 'C'].map((id, index) => { const demand = base[index] * (scenario === 'spike' && id === 'C' ? 2.2 : 1); return { zoneId: id, inletSensorId: `flow-${id}-in`, outletSensorId: `flow-${id}-out`, inlet: demand + (scenario === 'leak' && id === 'B' ? 12 : 0), outlet: demand, demand, valvePercent: 100, unit: 'L/min' }; }) };
}
