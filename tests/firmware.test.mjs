import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { validateTelemetry, frameToState, telemetryStatus, STALE_MS, DISCONNECTED_MS } from '../lib/telemetry.mjs';
import { prepare, cleanup } from '../scripts/wokwi-demo.mjs';
import { copyFile, mkdir, mkdtemp, readFile, writeFile, unlink, rmdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

// Reconstruct the checked-in C++ printf wire-format with bounded public fixtures.
// This validates the actual format contract; it is NOT execution in Wokwi.
const header = readFileSync(new URL('../hardware/wokwi-esp32/telemetry_payload.h', import.meta.url), 'utf8');
const literals = header.slice(header.indexOf('return snprintf'), header.indexOf('deviceId, bootId,'));
const format = [...literals.matchAll(/"(?:\\.|[^"\\])*"/g)].map(match => JSON.parse(match[0])).join('');
function firmwareFrame({ leak = false, sequence = 0, now = Date.now() } = {}) {
  const values = ['esp32-flowra-01', 'firmware-contract-0001', sequence, new Date(now).toISOString(), 78, 68, 24, 24, 24, leak ? 33.6 : 21.6, 21.6, 21.6, 14.4, 14.4, 14.4];
  let index = 0;
  const json = format.replace(/%%|%s|%lu|%\.(\d+)f/g, (token, decimals) => token === '%%' ? '%' : token === '%s' ? String(values[index++]) : token === '%lu' ? String(values[index++]) : Number(values[index++]).toFixed(Number(decimals)));
  assert.equal(index, values.length, 'C++ wire-format argument count changed');
  return JSON.parse(json);
}
test('ESP32 formatter contract produces complete normal frames with the real sensor IDs and units', () => {
  const now = Date.now(), frame = validateTelemetry(firmwareFrame({ now }), { now });
  assert.equal(frame.source, 'connected-simulated-esp32'); assert.equal(frame.tank.levelPercent, 78); assert.equal(frame.tank.unit, '%');
  assert.equal(frame.sourceFlow.flow, 68); assert.deepEqual(frame.zones.map(zone => zone.unit), ['L/min', 'L/min', 'L/min']);
  assert.equal(frameToState(frame).alerts.length, 0);
});
test('three firmware-format leak frames produce only the expected Zone B suspicion and age without fabricated updates', () => {
  const start = Date.now(); let state;
  for (let sequence = 0; sequence < 3; sequence++) { const now = start + sequence * 5000; const frame = validateTelemetry(firmwareFrame({ leak: true, sequence, now }), { now }); state = frameToState(frame, state, now); }
  assert.equal(state.zones[1].loss, 12); assert.equal(state.streaks[1], 3); assert.ok(state.alerts.some(alert => alert.zone === 'B'));
  assert.equal(state.sourceLabel, 'Connected simulated ESP32');
  assert.equal(telemetryStatus(state.receivedAt, state.receivedAt + STALE_MS), 'stale');
  assert.equal(telemetryStatus(state.receivedAt, state.receivedAt + DISCONNECTED_MS), 'disconnected'); assert.equal(state.history.length, 3);
});
test('firmware-shaped frames still reject wrong identifiers, clock, units and physical-source claims', () => {
  const now = Date.now();
  for (const mutate of [frame => { frame.zones[1].inletSensorId = 'wrong'; }, frame => { frame.tank.unit = 'L'; }, frame => { frame.source = 'physical'; }, frame => { frame.measuredAt = new Date(now - 31000).toISOString(); }]) {
    const frame = firmwareFrame({ now }); mutate(frame); assert.throws(() => validateTelemetry(frame, { now }));
  }
});
test('disposable local Wokwi setup never overwrites credentials or changes the application environment', async () => {
  await mkdir('.tools', { recursive: true });
  const root = await mkdtemp(join(process.cwd(), '.tools/wokwi-helper-test-'));
  await writeFile(join(root, '.env.local'), 'unchanged-private-config-fixture');
  try {
    await prepare(root);
    const config = JSON.parse(await readFile(join(root, '.tools/wokwi-demo.json'), 'utf8'));
    assert.equal(config.port, 3002); assert.equal(/^[a-f0-9]{64}$/.test(config.token), true);
    const header = await readFile(join(root, 'hardware/wokwi-esp32/secrets.h'), 'utf8');
    assert.equal(header.includes(config.token), true); assert.equal(header.includes('host.wokwi.internal:3002/api/telemetry'), true); assert.equal(header.includes('GEMINI_API_KEY'), false);
    await assert.rejects(() => prepare(root));
    await cleanup(root);
    assert.equal(await readFile(join(root, '.env.local'), 'utf8'), 'unchanged-private-config-fixture');
  } finally {
    await unlink(join(root, '.env.local'));
    for (const folder of ['hardware/wokwi-esp32', 'hardware', '.tools', '']) await rmdir(join(root, folder));
  }
});

test('the Wokwi serve CLI requires explicit Gemini opt-in and keeps the authenticated loopback receiver settings', async t => {
  const toolsDir = join(process.cwd(), '.tools');
  await mkdir(toolsDir, { recursive: true });
  const root = await mkdtemp(join(toolsDir, 'wokwi-serve-test-'));
  t.after(async () => {
    assert.equal(dirname(root), toolsDir);
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(join(root, 'scripts'));
  await mkdir(join(root, '.tools'));
  const launcher = join(root, 'scripts', 'wokwi-demo.mjs');
  await copyFile(new URL('../scripts/wokwi-demo.mjs', import.meta.url), launcher);
  const config = { deviceId: 'esp32-flowra-01', port: 3002, token: 'ab'.repeat(32) };
  await writeFile(join(root, '.tools', 'wokwi-demo.json'), JSON.stringify(config));
  await writeFile(join(root, '.env.local'), 'GEMINI_API_KEY=file-fixture\n');

  // Run the real launcher and Next.js env loader, with a probe in place of the HTTP server.
  await writeFile(join(root, 'package.json'), JSON.stringify({ private: true, scripts: { start: 'node probe.cjs' } }));
  await writeFile(join(root, 'probe.cjs'), `
    const assert = require('node:assert/strict');
    require('@next/env').loadEnvConfig(process.cwd());
    const config = require('./.tools/wokwi-demo.json');
    assert.deepEqual(process.argv.slice(2), ['--hostname', '127.0.0.1', '--port', '3002']);
    assert.ok(process.env.GEMINI_API_KEY === process.env.EXPECTED_TEST_KEY);
    assert.ok(process.env.FLOWRA_INGEST_TOKEN === config.token);
    assert.equal(process.env.FLOWRA_DEVICE_ID, config.deviceId);
    assert.equal(process.env.FLOWRA_PUBLIC_ORIGIN, '');
    console.log('Receiver settings verified.');
  `);
  const run = promisify(execFile);
  for (const [options, inheritedKey, expectedKey] of [
    [[], 'shell-fixture', ''],
    [['--with-gemini'], '', 'file-fixture'],
    [['--with-gemini'], 'shell-fixture', 'shell-fixture']
  ]) {
    const env = { ...process.env, NODE_ENV: 'production', GEMINI_API_KEY: inheritedKey, EXPECTED_TEST_KEY: expectedKey,
      FLOWRA_INGEST_TOKEN: 'other-fixture', FLOWRA_DEVICE_ID: 'other-device', FLOWRA_PUBLIC_ORIGIN: 'https://example.invalid' };
    delete env.__NEXT_PROCESSED_ENV;
    const { stdout } = await run(process.execPath, [launcher, 'serve', ...options], { cwd: root, env });
    assert.match(stdout, /Receiver settings verified/);
    assert.ok(stdout.includes(options.length ? 'Gemini allowed' : 'Gemini disabled'));
    for (const privateValue of [config.token, 'shell-fixture', 'file-fixture']) assert.ok(!stdout.includes(privateValue));
  }
  await assert.rejects(run(process.execPath, [launcher, 'serve', '--with-gemini', 'typo'], { cwd: root }), { code: 1 });
});
