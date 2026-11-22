import nextEnv from '@next/env';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { exampleFrame } from '../lib/telemetry-example.mjs';
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const endpoint = new URL(arg('url') || 'http://localhost:3000/api/telemetry');
if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash || !['http:', 'https:'].includes(endpoint.protocol)) throw new Error('Use a plain HTTP(S) ingestion URL without credentials or query parameters.');
if (endpoint.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)) throw new Error('Use HTTPS for non-local telemetry endpoints. Plain HTTP is allowed only for a loopback test server.');
const token = process.env.FLOWRA_INGEST_TOKEN;
const count = Number(arg('count') || 3), scenario = arg('scenario') || 'normal';
if (!token || token.length < 32) { console.error('Configure FLOWRA_INGEST_TOKEN in .env.local first. Its value will not be printed.'); process.exitCode = 1; }
else if (!Number.isInteger(count) || count < 1 || count > 120 || !['normal', 'leak', 'spike', 'low'].includes(scenario)) { console.error('Use count=1..120 and scenario=normal|leak|spike|low.'); process.exitCode = 1; }
else {
  const bootId = `node-${randomBytes(8).toString('hex')}`;
  console.log('Sending synthetic HTTP test data, not Wokwi or physical sensor data.');
  for (let sequence = 0; sequence < count; sequence++) {
    try {
      const response = await fetch(endpoint, { method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(exampleFrame({ scenario, sequence, bootId, deviceId: process.env.FLOWRA_DEVICE_ID || 'esp32-flowra-01' })), signal: AbortSignal.timeout(10000) });
      console.log(JSON.stringify({ sequence, httpStatus: response.status, accepted: response.status === 202 }));
      if (!response.ok) { process.exitCode = 1; break; }
    } catch { console.error('Telemetry request failed. Check that the local server is running; credentials and raw errors are not printed.'); process.exitCode = 1; break; }
    if (sequence + 1 < count) await delay(5000);
  }
}
