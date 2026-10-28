import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createWebAppServer } from './web-app-server.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const connectionFile = resolve(project, '.local/web-app/connection.json');
const connection = JSON.parse(readFileSync(connectionFile, 'utf8'));
const server = createWebAppServer({
  root: resolve(project, '.local/web-app/dist'),
  connectionFile,
  proxyProvider: connection.proxyProvider ?? 'cloudflare',
});
server.listen(7363, '127.0.0.1', () => console.log('Web App: http://127.0.0.1:7363'));
