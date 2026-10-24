import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { loadSharePreview, sharePreviewHTML } from './post-share-preview.mjs';

test('creates escaped per-post Open Graph metadata with a stable public image endpoint', () => {
  const token = 'a'.repeat(64),
    image = '11111111-1111-4111-8111-111111111111';
  const html = sharePreviewHTML(
    '<html><head><title>舊標題</title></head><body><div id="root"></div></body></html>',
    {
      author_name: 'A"<script>',
      content: '<script>bad()</script> & 晚餐',
      images: [{ id: image }],
    },
    'https://example.test',
    token,
  );
  assert.match(html, /property="og:title"/);
  assert.match(html, new RegExp(`/public/posts/${token}/images/${image}`));
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>bad/);
  assert.doesNotMatch(html, /舊標題/);
  assert.match(html, /noindex,nofollow/);
});

test('preview loader never forwards user credentials and handles missing and malformed posts', async () => {
  let status = 200,
    body = JSON.stringify({ content: '晚餐', author_name: '測試', images: [] });
  const api = createServer((req, res) => {
    assert.equal(req.headers.authorization, undefined);
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(body);
  });
  await new Promise((resolve) => api.listen(0, '127.0.0.1', resolve));
  try {
    assert.equal((await loadSharePreview(api.address().port, 'a'.repeat(64))).status, 200);
    status = 404;
    assert.equal((await loadSharePreview(api.address().port, 'a'.repeat(64))).status, 404);
    status = 200;
    body = 'malformed';
    assert.equal((await loadSharePreview(api.address().port, 'a'.repeat(64))).status, 503);
  } finally {
    await new Promise((resolve) => api.close(resolve));
  }
});
