const http = require('node:http');
const net = require('node:net');

// Only Metro and a single PUBLIC CA. App credentials/data use separate HTTPS8443.
function createMetroRelay({ host, clients, ca, port = 8081, upstreamPort = 18081 }) {
  const allowed = new Set(clients);
  const sockets = new Set();
  function permitted(socket) { return allowed.has(socket.remoteAddress); }
  const server = http.createServer((request, response) => {
    if (!permitted(request.socket)) { response.writeHead(403).end(); return; }
    if (request.url === '/device-ca.cer' && ['GET', 'HEAD'].includes(request.method) && ca) {
      response.writeHead(200, { 'Content-Type': 'application/x-x509-ca-cert',
        'Content-Disposition': 'attachment; filename="nccu-device-ca.cer"',
        'Cache-Control': 'no-store', 'Content-Length': ca.length });
      response.end(request.method === 'HEAD' ? undefined : ca);
      return;
    }
    if (!request.url.startsWith('/') || request.url.startsWith('//')) {
      response.writeHead(400).end(); return;
    }
    const upstream = http.request({ host: 'localhost', port: upstreamPort,
      method: request.method, path: request.url, headers: request.headers }, reply => {
      response.writeHead(reply.statusCode, reply.headers);
      reply.pipe(response);
    });
    upstream.setTimeout(120_000, () => upstream.destroy());
    upstream.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end(); });
    request.on('aborted', () => upstream.destroy());
    response.on('close', () => upstream.destroy());
    request.pipe(upstream);
  });
  server.on('connection', socket => {
    if (!permitted(socket) || sockets.size >= 32) { socket.destroy(); return; }
    sockets.add(socket);
    socket.setTimeout(120_000, () => socket.destroy());
    socket.on('error', () => {});
    socket.on('close', () => sockets.delete(socket));
  });
  server.on('upgrade', (request, client, head) => {
    if (!permitted(client) || !request.url.startsWith('/') || request.url.startsWith('//')) {
      client.destroy(); return;
    }
    const upstream = net.connect({ host: 'localhost', port: upstreamPort }, () => {
      const headers = [];
      for (let i = 0; i < request.rawHeaders.length; i += 2)
        headers.push(`${request.rawHeaders[i]}: ${request.rawHeaders[i + 1]}`);
      upstream.write(`${request.method} ${request.url} HTTP/1.1\r\n${headers.join('\r\n')}\r\n\r\n`);
      if (head.length) upstream.write(head);
      client.pipe(upstream);
      upstream.pipe(client);
    });
    sockets.add(upstream);
    upstream.setTimeout(120_000, () => upstream.destroy());
    upstream.on('error', () => client.destroy());
    client.on('close', () => upstream.destroy());
    upstream.on('close', () => { sockets.delete(upstream); client.destroy(); });
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 120_000;
  return {
    server,
    listen: () => new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, resolve);
    }),
    close: () => {
      for (const socket of sockets) socket.destroy();
      return new Promise(resolve => server.close(resolve));
    },
  };
}
module.exports = { createMetroRelay };
