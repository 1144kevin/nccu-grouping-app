import { spawn } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compressWebAssets } from './web-app-assets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const staging = resolve(root, '.local/web-app/export');
const target = resolve(root, '.local/web-app/dist');
// A relative API keeps the exported app usable on a new HTTPS QR URL without
// embedding a private IP, localhost, credentials, or an Expo Go address.
const rawApiBase = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
let apiBaseUrl = '/api/v1';
if (rawApiBase && rawApiBase !== '/api/v1') {
  const parsed = new URL(rawApiBase);
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== '/api/v1' ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '::1' ||
    /^[0-9.]+$/.test(host) ||
    host.includes(':') ||
    !host.includes('.') ||
    /\.(local|test|invalid|example)$/.test(host)
  ) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL must be /api/v1 or an exact HTTPS DNS address ending in /api/v1.',
    );
  }
  apiBaseUrl = `${parsed.origin}/api/v1`;
}
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) =>
      !/^(EXPO_PUBLIC_|EXPO_PACKAGER_|REACT_NATIVE_PACKAGER_|EAS_BUILD_PROFILE$|CORE_RELEASE_CHECK$)/i.test(
        name,
      ),
  ),
);
Object.assign(env, {
  EXPO_PUBLIC_CORE_API_ENABLED: 'true',
  EXPO_PUBLIC_CORE_DATA_MODE: 'supabase',
  EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
  EXPO_PUBLIC_APP_PROFILE: 'web',
  EXPO_PUBLIC_APPLE_INTAKE_ENABLED: 'false',
  EXPO_PUBLIC_APPLE_INTAKE_TRIAL: 'false',
  EXPO_NO_DOTENV: '1',
  EXPO_NO_TELEMETRY: '1',
  EXPO_OFFLINE: '1',
});
const child = spawn(
  process.execPath,
  [
    resolve(root, 'node_modules/expo/bin/cli'),
    'export',
    '--clear',
    '--platform',
    'web',
    '--max-workers',
    '2',
    '--output-dir',
    '.local/web-app/export',
  ],
  {
    cwd: root,
    env,
    stdio: 'inherit',
    windowsHide: true,
  },
);
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
  if (code !== 0) return;
  // Publish assets before HTML so a rebuild never leaves the shared page blank.
  // App artwork and the in-app BrandLogo are exported with the same build.
  try {
    const index = resolve(staging, 'index.html');
    const html = readFileSync(index, 'utf8').replace(
      /<link rel="icon" href="\/favicon\.ico"\s*\/?\s*>/g,
      '',
    );
    mkdirSync(target, { recursive: true });
    compressWebAssets(staging);
    cpSync(staging, target, { recursive: true, filter: (file) => file !== index });
    writeFileSync(resolve(target, 'index.next.html'), html);
    renameSync(resolve(target, 'index.next.html'), resolve(target, 'index.html'));
    console.log('Web App ready: .local/web-app/dist');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
});
