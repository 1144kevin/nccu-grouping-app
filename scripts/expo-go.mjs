import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const { expoGoEnv, expoGoArguments } = require('./expo-go-profile.cjs');
const { createMetroRelay } = require('./expo-go-relay.cjs');
const { readDeviceConnection } = require('./device-connection.cjs');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backend = resolve(root, '../nccu-grouping-backend');
const args = process.argv.slice(2);
const cliArgs = expoGoArguments(args);
if (process.platform !== 'win32') throw new Error('This launcher uses the checked Windows backend; use the native Mac handoff on Mac.');
const python = resolve(backend, '.venv/Scripts/python.exe');
const checked = spawnSync(python, ['scripts/device_link.py', 'expo-config'], {
  cwd: backend, encoding: 'utf8', windowsHide: true,
});
if (checked.status !== 0) throw new Error('Windows device/TLS check failed: ' + (checked.stderr || 'check backend configuration'));
const connection = JSON.parse(checked.stdout);
const env = expoGoEnv(connection);
const publicFile = resolve(backend, '.local/iphone-windows-link/device-connection.json');
if (readDeviceConnection(publicFile).api !== connection.api)
  throw new Error('Stale public connection; run backend device_link.py export first.');
const ca = readFileSync(resolve(dirname(publicFile), 'ca.cer'));
console.log(`Expo Go: exp://${connection.host}:8081`);
console.log(`API: ${connection.api} (HTTPS; requires iPhone CA trust)`);
console.log(`Public CA only: http://${connection.host}:8081/device-ca.cer`);
console.log(`Before trusting on iPhone, compare CA SHA256: ${createHash('sha256').update(ca).digest('hex')}`);
console.log('Email/password login; Windows AI retained. Google and Apple on-device AI require the native build.');
console.log('Metro stays on localhost:18081; private relay accepts only the configured iPhone(s). No tunnel/deployment.');
if (args.includes('--preview')) console.log('Local preview: production JavaScript without the development debugger; TLS validation unchanged.');
if (!args.includes('--check')) {
  const relay = createMetroRelay({ ...connection, ca });
  await relay.listen();
  const child = spawn(process.execPath, [resolve(root, 'node_modules/expo/bin/cli'),
    ...cliArgs], { cwd: root, stdio: 'inherit', env, windowsHide: true });
  let stopping = false;
  async function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    child.kill();
    await relay.close();
    process.exitCode = code;
  }
  process.on('SIGINT', () => { void stop(); });
  process.on('SIGTERM', () => { void stop(); });
  child.on('error', () => { console.error('Unable to start Expo CLI. Run npm ci first.'); void stop(1); });
  child.on('exit', code => { void stop(code ?? 1); });
  relay.server.on('error', error => { console.error(error.message); void stop(1); });
}
