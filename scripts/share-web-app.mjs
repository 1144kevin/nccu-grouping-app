import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWebAppServer } from './web-app-server.mjs';
import { writeWebAppQr } from './web-app-qr.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const local = resolve(root, '.local/web-app');
const executable = resolve(root, '../nccu-grouping-backend/.local/tools/cloudflared.exe');
if (!existsSync(executable))
  throw new Error(
    'Install the official Cloudflare cloudflared executable in the backend .local/tools folder first.',
  );
if (!existsSync(resolve(local, 'dist/index.html')))
  throw new Error('Run npm run build:web-app first.');
const gateway = createWebAppServer({
  root: resolve(local, 'dist'),
  connectionFile: resolve(local, 'connection.json'),
});
const log = resolve(local, 'tunnel.err.log');
const tunnel = spawn(
  executable,
  ['tunnel', '--url', 'http://127.0.0.1:7363', '--no-autoupdate', '--protocol', 'http2'],
  {
    cwd: root,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let logs = '',
  published = false,
  stopping = false;
function update(data) {
  logs = (logs + data.toString()).slice(-100_000);
  writeFileSync(log, logs);
  const url = logs.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
  if (url && !published) {
    published = true;
    const result = writeWebAppQr(url, local);
    console.log(
      `Web App: ${result.url}\nQR code: ${result.qr}\nKeep this computer and process running. Ctrl+C stops sharing.`,
    );
  }
}
tunnel.stdout.on('data', update);
tunnel.stderr.on('data', update);
function stop() {
  if (stopping) return;
  stopping = true;
  tunnel.kill();
  gateway.close();
}
tunnel.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
  stop();
});
tunnel.on('exit', (code) => {
  if (!stopping) {
    process.exitCode = code ?? 1;
    stop();
  }
});
gateway.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
  stop();
});
gateway.listen(7363, '127.0.0.1');
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
