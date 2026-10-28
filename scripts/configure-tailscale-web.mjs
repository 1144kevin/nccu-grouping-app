import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tailscaleWebOrigin } from './tailscale-web-origin.mjs';
import { writeWebAppQr } from './web-app-qr.mjs';

// Inspect by default. --apply only updates this project's origin/QR files;
// enabling public Funnel and updating Supabase remain explicit setup actions.
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--apply')) throw new Error('Usage: configure-tailscale-web.mjs [--apply]');
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const executable = resolve(process.env.ProgramFiles ?? 'C:/Program Files', 'Tailscale/tailscale.exe');
if (!existsSync(executable)) throw new Error('Install the official Tailscale Windows client first.');
const status = spawnSync(executable, ['status', '--json'], {
  encoding: 'utf8',
  windowsHide: true,
  timeout: 10_000,
  maxBuffer: 1024 * 1024,
});
if (status.error || status.status !== 0)
  throw new Error('Tailscale is not ready. Open Tailscale and finish signing in.');
const origin = tailscaleWebOrigin(JSON.parse(status.stdout));
console.log(`Assigned Web App origin: ${origin}`);
if (args.includes('--apply')) {
  writeWebAppQr(origin, resolve(project, '.local/web-app'), { proxyProvider: 'tailscale' });
  console.log('Project origin and QR updated. Verify public Funnel and Google callback before sharing.');
}
