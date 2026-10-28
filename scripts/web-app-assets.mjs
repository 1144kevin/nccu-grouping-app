import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

export function compressWebAssets(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) compressWebAssets(path);
    else if (entry.isFile() && /\.(?:js|css|svg|json|ttf|webmanifest)$/.test(entry.name)) {
      const original = readFileSync(path);
      if (original.length < 1024) continue;
      for (const [extension, compressed] of [
        ['br', brotliCompressSync(original, { params: { [constants.BROTLI_PARAM_QUALITY]: 6 } })],
        ['gz', gzipSync(original, { level: 9 })],
      ]) {
        if (compressed.length < original.length * 0.95)
          writeFileSync(`${path}.${extension}`, compressed);
      }
    }
  }
}

export function preferredEncodings(header = '') {
  const quality = new Map(
    String(header)
      .split(',')
      .map((part) => {
        const [name, ...params] = part.trim().toLowerCase().split(';');
        const q = params.find((value) => value.trim().startsWith('q='));
        return [name, q ? Number(q.trim().slice(2)) : 1];
      }),
  );
  return ['br', 'gzip']
    .map((name) => ({ name, q: quality.get(name) ?? quality.get('*') ?? 0 }))
    .filter(({ q }) => q > 0 && q <= 1)
    .sort((a, b) => b.q - a.q)
    .map(({ name }) => name);
}
