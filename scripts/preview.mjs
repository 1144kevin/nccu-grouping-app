import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, isAbsolute, join, normalize, relative, resolve } from 'node:path';

const port = Number(process.env.PORT ?? 7362);
const workspace = process.cwd();
const root = resolve(workspace, process.env.PREVIEW_ROOT ?? 'dist');
const within = (base, path) => {
  const part = relative(base, path);
  return part !== '..' && !part.startsWith('..\\') && !part.startsWith('../') && !isAbsolute(part);
};
if (!within(workspace, root) || !existsSync(root) || !within(realpathSync(workspace), realpathSync(root))) {
  throw new Error('Preview root must be an existing directory inside this project.');
}
const contentTypes = {
  '.css': 'text/css',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname); }
  catch { response.writeHead(400).end('Invalid path'); return; }
  const requestedPath = normalize(join(root, pathname));
  if (!within(root, requestedPath)) { response.writeHead(403).end('Forbidden'); return; }
  const candidates = [requestedPath, join(requestedPath, 'index.html'), join(root, 'index.html')];
  const filePath = candidates.find((candidate) => within(root, candidate) && existsSync(candidate)
    && within(realpathSync(root), realpathSync(candidate)) && statSync(candidate).isFile());

  if (!filePath) {
    response.writeHead(404).end('Not found');
    return;
  }

  response.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream' });
  createReadStream(filePath).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`Preview running at http://127.0.0.1:${port}`);
});
