import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { after, before, test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, request } from 'node:http';
import { createWebAppServer } from './web-app-server.mjs';

let root, api, gateway, port;
const publicOrigin = 'https://campus-fixture.trycloudflare.com';
const publicHeaders = {
  host: 'campus-fixture.trycloudflare.com',
  'x-forwarded-proto': 'https',
  'cf-connecting-ip': '198.51.100.20',
};
before(async () => {
  root = mkdtempSync(join(tmpdir(), 'nccu-web-'));
  writeFileSync(
    join(root, 'index.html'),
    '<html lang="zh-Hant"><head><title>政缺一咖</title></head><body>政缺一咖</body></html>',
  );
  writeFileSync(join(root, 'manifest.webmanifest'), '{"name":"政缺一咖"}');
  mkdirSync(join(root, '_expo'));
  api = createServer(async (req, res) => {
    if (req.url === `/api/v1/public/posts/${'a'.repeat(64)}`) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(
        JSON.stringify({ author_name: '分享主揪', content: '一起喝飲料', images: [] }),
      );
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    });
    res.end(
      JSON.stringify({
        path: req.url,
        headers: req.headers,
        body: Buffer.concat(chunks).toString(),
      }),
    );
  });
  await new Promise((r) => api.listen(0, '127.0.0.1', r));
  gateway = createWebAppServer({ root, backendPort: api.address().port, publicOrigin });
  await new Promise((r) => gateway.listen(0, '127.0.0.1', r));
  port = gateway.address().port;
});
after(async () => {
  await Promise.all([new Promise((r) => gateway.close(r)), new Promise((r) => api.close(r))]);
  rmSync(root, { recursive: true, force: true });
});
function call(path, { method = 'GET', headers = {}, body, targetPort = port } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: targetPort, path, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () =>
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString(),
        }),
      );
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

test('a configured custom domain accepts only its exact HTTPS host and origin', async () => {
  const custom = createWebAppServer({
    root,
    backendPort: api.address().port,
    publicOrigin: 'https://nccugrouping.com',
  });
  await new Promise((resolve) => custom.listen(0, '127.0.0.1', resolve));
  try {
    const targetPort = custom.address().port;
    const headers = {
      ...publicHeaders,
      host: 'nccugrouping.com',
      origin: 'https://nccugrouping.com',
    };
    assert.equal((await call('/', { headers, targetPort })).status, 200);
    assert.equal(
      (await call('/', { headers: { ...headers, host: 'app.nccugrouping.com' }, targetPort }))
        .status,
      403,
    );
    assert.equal(
      (await call('/', { headers: { ...headers, origin: 'https://elsewhere.com' }, targetPort }))
        .status,
      403,
    );
    assert.equal(
      (await call('/', { headers: { ...headers, 'x-forwarded-proto': 'http' }, targetPort }))
        .status,
      403,
    );
  } finally {
    await new Promise((resolve) => custom.close(resolve));
  }
});
test('serves the app on deep links and refresh, and serves manifest metadata', async () => {
  const page = await call('/direct-chat/example', { headers: publicHeaders });
  assert.equal(page.status, 200);
  assert.match(page.body, /政缺一咖/);
  const manifest = await call('/manifest.webmanifest');
  assert.match(manifest.headers['content-type'], /application\/manifest\+json/);
  assert.equal((await call('/_expo/missing.js')).status, 404);
});

test('Tailscale validates its overwritten proxy headers and isolates public and tailnet visitor quotas', async () => {
  const funnel = createWebAppServer({
    root,
    backendPort: api.address().port,
    publicOrigin: 'https://campus.fixture.ts.net',
    proxyProvider: 'tailscale',
    requestLimit: 2,
  });
  await new Promise((resolve) => funnel.listen(0, '127.0.0.1', resolve));
  try {
    const targetPort = funnel.address().port;
    const headers = {
      host: 'campus.fixture.ts.net',
      origin: 'https://campus.fixture.ts.net',
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'campus.fixture.ts.net',
      'x-forwarded-for': '198.51.100.1',
      'tailscale-funnel-request': '?1',
      'cf-connecting-ip': '203.0.113.99',
    };
    const invalid = [
      { ...headers, 'x-forwarded-host': '' },
      { ...headers, 'x-forwarded-for': '198.51.100.1, 203.0.113.2' },
      { ...headers, host: 'other.fixture.ts.net' },
      { ...headers, 'x-forwarded-proto': 'http' },
      { ...headers, origin: 'https://elsewhere.com' },
    ];
    for (const value of invalid)
      assert.equal((await call('/', { headers: value, targetPort })).status, 403);
    for (let index = 0; index < 2; index++)
      assert.equal((await call('/', { headers, targetPort })).status, 200);
    assert.equal((await call('/', { headers, targetPort })).status, 429);
    // Forging Cloudflare's header cannot evade the Tailscale visitor quota.
    assert.equal(
      (
        await call('/', {
          headers: { ...headers, 'cf-connecting-ip': '203.0.113.100' },
          targetPort,
        })
      ).status,
      429,
    );
    // A second real visitor does not share the first visitor's quota.
    assert.equal(
      (await call('/', { headers: { ...headers, 'x-forwarded-for': '198.51.100.2' }, targetPort }))
        .status,
      200,
    );
    const tailnetHeaders = { ...headers, 'x-forwarded-for': '100.64.0.2' };
    delete tailnetHeaders['tailscale-funnel-request'];
    assert.equal((await call('/', { headers: tailnetHeaders, targetPort })).status, 200);
  } finally {
    await new Promise((resolve) => funnel.close(resolve));
  }
});
test('same-origin API preserves auth, JSON, query and retry keys without forwarding public proxy headers', async () => {
  const result = await call('/api/v1/posts?limit=5', {
    method: 'POST',
    headers: {
      ...publicHeaders,
      origin: publicOrigin,
      'content-type': 'application/json',
      authorization: 'Bearer synthetic-user-session',
      'idempotency-key': 'synthetic-message-key',
      'x-forwarded-for': '203.0.113.9',
      'x-real-ip': '203.0.113.9',
      cookie: 'unrelated=value',
    },
    body: '{"content":"一起吃晚餐"}',
  });
  assert.equal(result.status, 200);
  const upstream = JSON.parse(result.body);
  assert.equal(upstream.path, '/api/v1/posts?limit=5');
  assert.equal(upstream.headers.authorization, 'Bearer synthetic-user-session');
  assert.equal(upstream.headers['idempotency-key'], 'synthetic-message-key');
  assert.equal(upstream.body, '{"content":"一起吃晚餐"}');
  for (const name of [
    'origin',
    'x-forwarded-for',
    'x-forwarded-proto',
    'x-real-ip',
    'cookie',
    'cf-connecting-ip',
  ])
    assert.equal(upstream.headers[name], undefined);
  assert.equal(result.headers['cache-control'], 'no-store');
});
test('rejects foreign hosts/origins, insecure public requests, and cross-site requests', async () => {
  assert.equal((await call('/', { headers: { host: 'evil.example' } })).status, 403);
  assert.equal(
    (await call('/api/v1/posts', { headers: { ...publicHeaders, origin: 'https://evil.example' } }))
      .status,
    403,
  );
  assert.equal(
    (await call('/', { headers: { ...publicHeaders, 'x-forwarded-proto': 'http' } })).status,
    403,
  );
  assert.equal(
    (await call('/', { headers: { ...publicHeaders, 'sec-fetch-site': 'cross-site' } })).status,
    403,
  );
});
test('allows only top-level OAuth return navigation across sites, preserving API protections', async () => {
  const headers = {
    ...publicHeaders,
    'sec-fetch-site': 'cross-site',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-dest': 'document',
  };
  const returned = await call('/auth/callback?code=synthetic-code', { headers });
  assert.equal(returned.status, 200);
  assert.match(returned.body, /政缺一咖/);
  assert.equal(returned.headers['referrer-policy'], 'no-referrer');
  assert.equal(returned.headers['cache-control'], 'no-store');
  assert.equal((await call('/api/v1/auth/me', { headers })).status, 403);
  assert.equal((await call('/auth/callback', { method: 'POST', headers })).status, 403);
  assert.equal(
    (await call('/auth/callback', { headers: { ...headers, 'sec-fetch-mode': 'cors' } })).status,
    403,
  );
  assert.equal(
    (await call('/auth/callback', { headers: { ...headers, 'sec-fetch-dest': 'iframe' } })).status,
    403,
  );
});

test('allows a shared post opened from LINE while keeping cross-site API and embedded-page requests blocked', async () => {
  const headers = {
    ...publicHeaders,
    'sec-fetch-site': 'cross-site',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-dest': 'document',
  };
  const page = await call(`/s/${'a'.repeat(64)}`, { headers });
  assert.equal(page.status, 200);
  assert.match(page.body, /og:title/);
  assert.match(page.body, /分享主揪/);
  assert.equal(
    (await call(`/s/${'a'.repeat(64)}`, { headers: { ...headers, 'sec-fetch-dest': 'iframe' } }))
      .status,
    403,
  );
  assert.equal((await call(`/api/v1/public/posts/${'a'.repeat(64)}`, { headers })).status, 403);
  assert.equal((await call('/api/v1/auth/me', { headers })).status, 403);
});
test('does not expose development tools, alternate API roots, private files or source maps', async () => {
  for (const path of [
    '/docs',
    '/openapi.json',
    '/.env',
    '/.git/config',
    '/%2e%2e/secret',
    '/api/v1/development/demo',
    '/api/v1/stealth/signals',
    '/api/elsewhere',
    '/_expo/source.js.map',
  ]) {
    const result = await call(path);
    if (path === '/docs') assert.ok(!result.body.includes('swagger'));
    else assert.equal(result.status, 404, path);
  }
});
test('forwards the authenticated read-only server clock without exposing development tools', async () => {
  const clock = await call('/api/v1/development/clock', {
    headers: { ...publicHeaders, authorization: 'Bearer synthetic-clock-session' },
  });
  assert.equal(clock.status, 200);
  assert.equal(JSON.parse(clock.body).headers.authorization, 'Bearer synthetic-clock-session');
  for (const path of [
    '/api/v1/development/clock/',
    '/api/v1/development/demo',
    '/api/v1/development/clock/reset',
  ])
    assert.equal((await call(path)).status, 404);
  assert.equal((await call('/api/v1/development/clock', { method: 'POST' })).status, 404);
});
test('permits a five-photo JSON payload only on the AI post-writing endpoint', async () => {
  const body = JSON.stringify({ images_base64: Array(5).fill('a'.repeat(1400000)) });
  const result = await call('/api/v1/ai/post-writing', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  assert.equal(result.status, 200);
  assert.equal(JSON.parse(JSON.parse(result.body).body).images_base64.length, 5);
  assert.equal(
    (
      await call('/api/v1/ai/post-writing', {
        method: 'POST',
        headers: { 'content-length': String(31 * 1024 * 1024) },
      })
    ).status,
    413,
  );
});
test('bounds uploads and only forwards JSON API requests', async () => {
  assert.equal(
    (
      await call('/api/v1/posts', {
        method: 'POST',
        headers: { 'content-length': String(7 * 1024 * 1024) },
      })
    ).status,
    413,
  );
  assert.equal(
    (
      await call('/api/v1/posts', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'text',
      })
    ).status,
    415,
  );
});
test('limits repeated auth attempts at the public entry', async () => {
  for (let i = 0; i < 20; i++)
    assert.equal(
      (
        await call('/api/v1/auth/me', {
          headers: { ...publicHeaders, 'cf-connecting-ip': '198.51.100.40' },
        })
      ).status,
      200,
    );
  for (let i = 0; i < 15; i++)
    assert.equal(
      (
        await call('/api/v1/auth/google/start', {
          method: 'POST',
          headers: { ...publicHeaders, 'cf-connecting-ip': '198.51.100.40' },
        })
      ).status,
      200,
    );
  const limited = await call('/api/v1/auth/google/start', {
    method: 'POST',
    headers: { ...publicHeaders, 'cf-connecting-ip': '198.51.100.40' },
  });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers['retry-after'], '60');
});

test('five users behind the same Wi-Fi can poll their app without exhausting a single-user budget', async () => {
  const statuses = await Promise.all(
    Array.from({ length: 5 }, async (_, actor) => {
      const results = [];
      for (let request = 0; request < 60; request++) {
        results.push(
          (
            await call('/api/v1/posts', {
              headers: {
                ...publicHeaders,
                'cf-connecting-ip': '198.51.100.70',
                authorization: `Bearer synthetic-account-${actor}`,
              },
            })
          ).status,
        );
      }
      return results;
    }),
  );
  assert.equal(statuses.flat().length, 300);
  assert.ok(statuses.flat().every((status) => status === 200));
});
