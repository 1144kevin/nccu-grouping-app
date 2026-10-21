const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const http = require('node:http');
const { once } = require('node:events');
const { expoGoEnv } = require('./expo-go-profile.cjs');
const { createMetroRelay } = require('./expo-go-relay.cjs');
const good = { host: '172.20.10.2', clients: ['172.20.10.1'],
  api: 'https://172.20.10.2:8443/api/v1', leaf_expires: '2035-01-01T00:00:00Z' };

test('Expo Go uses Supabase HTTPS and Windows AI without inheriting trial or public credentials', () => {
  const env = expoGoEnv(good, { PATH: 'keep', EXPO_PUBLIC_SECRET: 'drop',
    EXPO_PUBLIC_APPLE_INTAKE_TRIAL: 'true', EXPO_PACKAGER_PROXY_URL: 'https://evil.invalid',
    REACT_NATIVE_PACKAGER_HOSTNAME: 'evil.invalid', EAS_BUILD_PROFILE: 'production' });
  assert.equal(env.PATH, 'keep');
  assert.equal(env.EXPO_PUBLIC_SECRET, undefined);
  assert.equal(env.REACT_NATIVE_PACKAGER_HOSTNAME, undefined);
  assert.equal(env.EXPO_PUBLIC_CORE_DATA_MODE, 'supabase');
  assert.equal(env.EXPO_PUBLIC_API_BASE_URL, good.api);
  assert.equal(env.EXPO_PUBLIC_APPLE_INTAKE_TRIAL, 'false');
  assert.equal(env.EXPO_PUBLIC_APPLE_INTAKE_ENABLED, 'false');
  assert.equal(env.EXPO_PACKAGER_PROXY_URL, 'http://172.20.10.2:8081');
  assert.equal(env.EXPO_NO_DOTENV, '1');
});
test('reject public clients, mismatched hosts, expired TLS and cleartext APIs', () => {
  for (const patch of [
    { clients: [] }, { clients: ['140.119.125.3'] }, { clients: [good.host] },
    { clients: ['172.20.10.1', '172.20.10.1'] }, { host: '0.0.0.0' },
    { api: 'http://172.20.10.2:8443/api/v1' },
    { api: 'https://172.20.10.3:8443/api/v1' },
    { leaf_expires: '2000-01-01T00:00:00Z' },
  ]) assert.throws(() => expoGoEnv({ ...good, ...patch }));
});
test('private Metro relay serves public CA, proxies HTTP/WebSockets and denies other sources', async () => {
  let connections = 0;
  const upstream = http.createServer((request, response) => response.end('synthetic-metro-bundle'));
  upstream.on('connection', () => { connections++; });
  upstream.on('upgrade', (_request, socket, head) => {
    socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
    if (head.length) socket.write(head);
    socket.pipe(socket);
  });
  upstream.listen(0, 'localhost');
  await once(upstream, 'listening');
  const options = { host: '127.0.0.1', port: 0, upstreamPort: upstream.address().port };
  const denied = createMetroRelay({ ...options, clients: ['192.168.1.20'] });
  const allowed = createMetroRelay({ ...options, clients: ['127.0.0.1'], ca: Buffer.from('synthetic-public-ca') });
  try {
    await denied.listen();
    const rejected = net.connect(denied.server.address().port, '127.0.0.1');
    rejected.on('error', () => {});
    await once(rejected, 'close');
    assert.equal(connections, 0);
    await allowed.listen();
    const base = `http://127.0.0.1:${allowed.server.address().port}`;
    assert.equal(await (await fetch(base + '/device-ca.cer')).text(), 'synthetic-public-ca');
    assert.equal(connections, 0, 'public CA never reads any arbitrary backend file');
    assert.equal(await (await fetch(base + '/entry.bundle?platform=ios')).text(), 'synthetic-metro-bundle');
    const client = net.connect(allowed.server.address().port, '127.0.0.1');
    const handshake = once(client, 'data');
    client.write('GET /hot HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
    assert.match((await handshake)[0].toString(), /101 Switching Protocols/);
    const reply = once(client, 'data');
    client.write('synthetic-metro-websocket-bytes');
    assert.equal((await reply)[0].toString(), 'synthetic-metro-websocket-bytes');
    assert.equal(connections, 2);
    client.destroy();
  } finally {
    await denied.close();
    await allowed.close();
    await new Promise(resolve => upstream.close(resolve));
  }
});
