import { createReadStream, existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { Buffer } from 'node:buffer';
import { isIP } from 'node:net';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { loadSharePreview, sharePreviewHTML } from './post-share-preview.mjs';
import { webAppOrigin } from './web-app-origin.mjs';
import { preferredEncodings } from './web-app-assets.mjs';

const MAX_BODY = 6 * 1024 * 1024;
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
};
const within = (base, file) => {
  const part = relative(base, file);
  return part !== '..' && !part.startsWith('../') && !part.startsWith('..\\') && !isAbsolute(part);
};

export function createWebAppServer({
  root,
  connectionFile,
  backendPort = 8000,
  publicOrigin,
  proxyProvider = 'cloudflare',
  // Five people behind one Wi-Fi/NAT share an IP, including chat and job polls.
  requestLimit = 1200,
  authLimit = 15,
  maxBodyReaders = 8,
}) {
  if (!['cloudflare', 'tailscale'].includes(proxyProvider))
    throw new Error('Select an explicitly supported web proxy provider.');
  root = realpathSync(root);
  if (!existsSync(resolve(root, 'index.html'))) throw new Error('Build the Web App first.');
  const requests = new Map();
  let bodyReaders = 0;
  function origin() {
    const value =
      publicOrigin ??
      (() => {
        try {
          return JSON.parse(readFileSync(connectionFile, 'utf8')).url;
        } catch {
          return null;
        }
      })();
    if (!value) return null;
    return webAppOrigin(value);
  }
  function allowed(key, limit) {
    const now = Date.now();
    for (const [id, value] of requests) if (value.until <= now) requests.delete(id);
    if (!requests.has(key)) {
      if (requests.size >= 4096) return false;
      requests.set(key, { until: now + 60_000, count: 0 });
    }
    return ++requests.get(key).count <= limit;
  }
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    const fail = (status, detail) => {
      res.writeHead(status, { 'Content-Type': 'application/json', Connection: 'close' });
      res.end(JSON.stringify({ detail }));
    };
    try {
      // The browser gateway and tunnel target bind to loopback. Nothing opens
      // the private API or the model port directly to the network.
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress))
        return fail(403, 'loopback_gateway_only');
      const host = req.headers.host;
      const local =
        host === `127.0.0.1:${server.address().port}` ||
        host === `localhost:${server.address().port}`;
      const shared = origin();
      if (!local && (!shared || host !== new URL(shared).host))
        return fail(403, 'share_host_not_allowed');
      const expectedOrigin = local ? `http://${host}` : shared;
      if (req.headers.origin && req.headers.origin !== expectedOrigin)
        return fail(403, 'share_origin_not_allowed');
      // Supabase returns a top-level navigation after Google login. This narrow
      // exception never permits cross-site API calls, forms or embedded content.
      const oauthReturn =
        ['GET', 'HEAD'].includes(req.method) &&
        req.url?.split('?')[0] === '/auth/callback' &&
        req.headers['sec-fetch-mode'] === 'navigate' &&
        req.headers['sec-fetch-dest'] === 'document';
      const sharePage = /^\/s\/[0-9a-f]{64}$/.test(req.url?.split('?')[0] ?? '');
      const publicImage = /^\/api\/v1\/public\/posts\/[0-9a-f]{64}\/images\/[0-9a-f-]{36}$/.test(
        req.url?.split('?')[0] ?? '',
      );
      const publicRead =
        ['GET', 'HEAD'].includes(req.method) &&
        ((sharePage &&
          req.headers['sec-fetch-mode'] === 'navigate' &&
          req.headers['sec-fetch-dest'] === 'document') ||
          (publicImage && req.headers['sec-fetch-dest'] === 'image'));
      if (req.headers['sec-fetch-site'] === 'cross-site' && !oauthReturn && !publicRead)
        return fail(403, 'cross_site_request');
      if (!local && req.headers['x-forwarded-proto'] !== 'https')
        return fail(403, 'https_required');
      // Tailscale 1.104.4 overwrites the forwarded host/proto/IP. The same
      // hostname is also reachable privately from devices in the tailnet;
      // those requests do not have the public-only Funnel marker.
      // Never trust a client-supplied Cloudflare IP through this ingress.
      let peer = 'local';
      if (!local) {
        if (proxyProvider === 'tailscale') {
          const forwarded = req.headers['x-forwarded-for'];
          if (
            req.headers['x-forwarded-host'] !== host ||
            typeof forwarded !== 'string' ||
            !isIP(forwarded)
          )
            return fail(403, 'invalid_funnel_proxy');
          peer = forwarded;
        } else peer = String(req.headers['cf-connecting-ip'] ?? 'unknown');
      }
      if (!allowed(peer, requestLimit)) {
        res.setHeader('Retry-After', '60');
        return fail(429, 'too_many_requests');
      }
      const rawPath = req.url?.split('?')[0] ?? '/';
      const pathname = decodeURIComponent(rawPath);
      if (
        !pathname.startsWith('/') ||
        pathname.startsWith('//') ||
        pathname.includes('\\') ||
        pathname.includes('\0') ||
        pathname.split('/').some((part) => part.startsWith('.'))
      )
        return fail(404, 'not_found');
      if (pathname.startsWith('/api/')) {
        const serverClock = pathname === '/api/v1/development/clock' && req.method === 'GET';
        const postWriting =
          ['/api/v1/ai/post-writing', '/api/v1/ai/post-writing/jobs'].includes(pathname) &&
          req.method === 'POST';
        const modelRequest =
          req.method === 'POST' &&
          /^\/api\/v1\/stealth-cloud\/(?:conversation|quick-start|quick-interview|draft|intake|matches\/(?:semantic|discover|[0-9a-f-]{36}\/reply-suggestions))$/.test(
            pathname,
          );
        if (
          !pathname.startsWith('/api/v1/') ||
          pathname.includes('//') ||
          (/^\/api\/v1\/(development|demo|stealth)(\/|$)/.test(pathname) && !serverClock)
        )
          return fail(404, 'not_found');
        if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method))
          return fail(405, 'method_not_allowed');
        if (
          pathname.startsWith('/api/v1/auth/') &&
          req.method !== 'GET' &&
          !allowed(`auth:${peer}`, authLimit)
        ) {
          res.setHeader('Retry-After', '60');
          return fail(429, 'too_many_auth_attempts');
        }
        const maxBody = postWriting ? 30 * 1024 * 1024 : MAX_BODY;
        const length = Number(req.headers['content-length'] ?? 0);
        if (!Number.isSafeInteger(length) || length < 0 || length > maxBody)
          return fail(413, 'request_body_too_large');
        const chunks = [];
        let size = 0;
        const hasBody = length > 0 || !!req.headers['transfer-encoding'];
        if (hasBody && bodyReaders >= maxBodyReaders) {
          res.setHeader('Retry-After', '3');
          return fail(429, 'upload_gateway_busy');
        }
        if (hasBody) bodyReaders += 1;
        try {
          for await (const chunk of req) {
            size += chunk.length;
            if (size > maxBody) return fail(413, 'request_body_too_large');
            chunks.push(chunk);
          }
        } finally {
          if (hasBody) bodyReaders -= 1;
        }
        if (size && req.headers['content-type']?.split(';')[0] !== 'application/json')
          return fail(415, 'json_body_required');
        // Supply only the existing API's supported headers. Public browser and
        // proxy headers are validated here, never passed off as trusted API input.
        const headers = { accept: 'application/json', 'content-length': size };
        for (const name of ['authorization', 'content-type', 'idempotency-key'])
          if (req.headers[name]) headers[name] = req.headers[name];
        const upstream = httpRequest(
          { host: '127.0.0.1', port: backendPort, path: req.url, method: req.method, headers },
          (reply) => {
            res.statusCode = reply.statusCode ?? 502;
            res.setHeader('Content-Type', reply.headers['content-type'] ?? 'application/json');
            if (reply.headers['retry-after'])
              res.setHeader('Retry-After', reply.headers['retry-after']);
            reply.on('error', () => res.destroy());
            reply.pipe(res);
          },
        );
        upstream.setTimeout(postWriting ? 420_000 : modelRequest ? 330_000 : 90_000, () =>
          upstream.destroy(new Error('timeout')),
        );
        upstream.on('error', () => {
          if (!res.headersSent) fail(502, 'backend_unavailable');
          else res.destroy();
        });
        res.on('close', () => {
          if (!res.writableFinished) upstream.destroy();
        });
        upstream.end(Buffer.concat(chunks));
        return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) return fail(405, 'method_not_allowed');
      if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end('{"status":"ok","app":"web"}');
      }
      if (sharePage) {
        const token = pathname.slice(3);
        const preview = await loadSharePreview(backendPort, token);
        res.writeHead(preview.status, { 'Content-Type': 'text/html; charset=utf-8' });
        if (req.method === 'HEAD') return res.end();
        return res.end(
          sharePreviewHTML(
            readFileSync(resolve(root, 'index.html'), 'utf8'),
            preview.data,
            expectedOrigin,
            token,
          ),
        );
      }
      const requested = resolve(root, `.${pathname}`);
      let file =
        within(root, requested) &&
        existsSync(requested) &&
        within(root, realpathSync(requested)) &&
        statSync(requested).isFile()
          ? requested
          : null;
      // Direct links and refreshes load the same app. Missing script/image files
      // must return 404, never HTML disguised as a JavaScript bundle.
      if (!file && !extname(pathname) && !pathname.startsWith('/_expo/'))
        file = resolve(root, 'index.html');
      if (!file || pathname.endsWith('.map')) return fail(404, 'not_found');
      const contentType = mime[extname(file)] ?? 'application/octet-stream';
      if (/\.(?:js|css|svg|json|ttf|webmanifest)$/.test(file)) {
        res.setHeader('Vary', 'Accept-Encoding');
        for (const encoding of preferredEncodings(req.headers['accept-encoding'])) {
          const candidate = `${file}.${encoding === 'gzip' ? 'gz' : 'br'}`;
          if (
            existsSync(candidate) &&
            within(root, realpathSync(candidate)) &&
            statSync(candidate).isFile()
          ) {
            file = candidate;
            res.setHeader('Content-Encoding', encoding);
            break;
          }
        }
      }
      // Only exported, content-addressed public assets are immutable. HTML,
      // signed images, account responses, and shared-post previews stay no-store.
      if (/^\/(?:_expo\/static\/|assets\/).*[-.][a-f0-9]{16,}\.[a-z0-9]+$/.test(pathname))
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Content-Length', statSync(file).size);
      res.writeHead(200, { 'Content-Type': contentType });
      if (req.method === 'HEAD') return res.end();
      const stream = createReadStream(file);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    } catch {
      if (!res.headersSent) fail(400, 'invalid_request');
      else res.destroy();
    }
  });
  // Five phones can upload albums over a shared mobile uplink. Keep this
  // bounded separately from the short header deadline and the reader slots.
  server.requestTimeout = 120_000;
  server.headersTimeout = 10_000;
  server.on('upgrade', (_req, socket) => socket.destroy());
  return server;
}
