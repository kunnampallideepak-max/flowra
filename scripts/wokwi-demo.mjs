// Private, disposable local test configuration. Never reads or edits .env.local.
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { spawn, execFile } from 'node:child_process';
const workspace = fileURLToPath(new URL('../', import.meta.url));
const marker = '// Flowra disposable local Wokwi test configuration';
const paths = root => ({ config: join(root, '.tools/wokwi-demo.json'), header: join(root, 'hardware/wokwi-esp32/secrets.h') });
export async function prepare(root = workspace) {
  const files = paths(root);
  for (const path of Object.values(files)) { let exists = false; try { await access(path); exists = true; } catch {} if (exists) throw new Error('Private test configuration already exists. Stop its server and run cleanup, or back up your own secrets.h manually. Nothing was overwritten.'); }
  const config = { deviceId: 'esp32-flowra-01', port: 3002, token: randomBytes(32).toString('hex') };
  await mkdir(join(root, '.tools'), { recursive: true }); await mkdir(join(root, 'hardware/wokwi-esp32'), { recursive: true });
  await writeFile(files.config, JSON.stringify(config), { mode: 0o600, flag: 'wx' });
  try { await writeFile(files.header, `${marker}\n#pragma once\n#define FLOWRA_URL "http://host.wokwi.internal:3002/api/telemetry"\n#define FLOWRA_DEVICE_ID "${config.deviceId}"\n#define FLOWRA_TOKEN "${config.token}"\nstatic const char FLOWRA_CA_CERT[] = "";\n`, { mode: 0o600, flag: 'wx' }); }
  catch (error) { await unlink(files.config); throw error; }
}
async function readConfig(root) {
  const value = JSON.parse(await readFile(paths(root).config, 'utf8'));
  if (Object.keys(value).sort().join(',') !== 'deviceId,port,token' || value.deviceId !== 'esp32-flowra-01' || value.port !== 3002 || typeof value.token !== 'string' || !/^[a-f0-9]{64}$/.test(value.token)) throw new Error('Private disposable configuration is invalid.');
  return value;
}
export async function cleanup(root = workspace) {
  const config = await readConfig(root), files = paths(root);
  const header = await readFile(files.header, 'utf8');
  if (!header.startsWith(marker) || !header.includes(`"${config.token}"`)) throw new Error('The header is not the generated disposable configuration. Nothing was deleted.');
  await unlink(files.header); await unlink(files.config);
}
async function serve() {
  const config = await readConfig(workspace);
  const env = { ...process.env, GEMINI_API_KEY: '', FLOWRA_PUBLIC_ORIGIN: '', FLOWRA_INGEST_TOKEN: config.token, FLOWRA_DEVICE_ID: config.deviceId };
  const windows = process.platform === 'win32';
  const child = windows ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd start -- --hostname 127.0.0.1 --port 3002'], { cwd: workspace, env, stdio: 'inherit', windowsHide: true }) : spawn('npm', ['start', '--', '--hostname', '127.0.0.1', '--port', '3002'], { cwd: workspace, env, stdio: 'inherit' });
  let stopping = false;
  const stop = () => {
    if (stopping) return; stopping = true;
    // Kill only this helper's own spawned process tree; never discover/kill by port.
    if (windows && child.pid) execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => process.exit(0));
    else child.kill('SIGTERM');
  };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  child.on('error', () => { console.error('Could not start the local test server. Build Flowra first.'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = stopping ? 0 : code || 0; });
  console.log('Disposable test server: http://127.0.0.1:3002. Gemini disabled in this process. Ctrl+C stops it. No tunnel or public binding.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  try {
    if (command === 'prepare') { await prepare(); console.log('Prepared private disposable firmware/server configuration. No credential was printed. Build the firmware next.'); }
    else if (command === 'serve') await serve();
    else if (command === 'cleanup') { await cleanup(); console.log('Removed generated private configuration. A stopped test server no longer accepts its token. Rebuild before sharing firmware.'); }
    else console.log('Usage: node scripts/wokwi-demo.mjs prepare | serve | cleanup\nPrepare refuses to overwrite private configuration. Serve requires npm.cmd run build. Stop the server before cleanup; leave .env.local unchanged.');
  } catch { console.error('Local Wokwi setup could not be completed. Check existing private files, permissions and the documented prepare/serve/cleanup sequence. No credentials are logged.'); process.exitCode = 1; }
}
