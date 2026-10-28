import { writeFileSync, mkdirSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { toQR } from 'toqr';
import { webAppOrigin } from './web-app-origin.mjs';

// PNG encoding uses only Node's standard library; the QR matrix is supplied by
// the same encoder already used by Expo CLI. No remote QR service receives URLs.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([size, body, crc]);
}
export function writeWebAppQr(url, directory, { proxyProvider = 'cloudflare' } = {}) {
  if (!['cloudflare', 'tailscale'].includes(proxyProvider))
    throw new Error('Select an explicitly supported web proxy provider.');
  const parsed = new URL(webAppOrigin(url));
  if (proxyProvider === 'tailscale' && !parsed.hostname.endsWith('.ts.net'))
    throw new Error('Tailscale Funnel requires its exact assigned ts.net hostname.');
  const matrix = toQR(parsed.origin);
  const modules = Math.sqrt(matrix.length);
  const scale = 10,
    quiet = 4,
    width = (modules + quiet * 2) * scale;
  const rows = Buffer.alloc((width + 1) * width, 255);
  for (let y = 0; y < width; y++) {
    rows[y * (width + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const row = Math.floor(y / scale) - quiet,
        col = Math.floor(x / scale) - quiet;
      if (row >= 0 && col >= 0 && row < modules && col < modules && matrix[row * modules + col])
        rows[y * (width + 1) + x + 1] = 0;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(width, 4);
  header[8] = 8;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    resolve(directory, 'connection.json'),
    JSON.stringify({ url: parsed.origin, proxyProvider, created_at: new Date().toISOString() }, null, 2),
  );
  writeFileSync(resolve(directory, 'qr-code.png'), png);
  return { url: parsed.origin, qr: resolve(directory, 'qr-code.png') };
}
