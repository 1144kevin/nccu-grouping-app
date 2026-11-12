import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const account = process.argv.includes('--account');
const child = spawn(process.execPath, [resolve(root, 'node_modules/expo/bin/cli'), 'start', '--clear', '--web', '--localhost', '--port', account ? '8082' : '8081'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    EXPO_PUBLIC_CORE_API_ENABLED: 'true',
    EXPO_PUBLIC_ACCOUNT_WEB: account ? 'true' : 'false',
    EXPO_PUBLIC_APPLE_INTAKE_TRIAL: 'false',
    EXPO_PUBLIC_APPLE_INTAKE_ENABLED: 'false',
    EXPO_NO_DOTENV: '1',
    EXPO_PUBLIC_CORE_DATA_MODE: process.argv.includes('--supabase') ? 'supabase' : 'sqlite',
    EXPO_PUBLIC_API_BASE_URL: 'http://127.0.0.1:8000/api/v1',
    EXPO_OFFLINE: '1',
    EXPO_NO_TELEMETRY: '1',
  },
});
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
