import { request } from 'node:http';
import { Buffer } from 'node:buffer';

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

export function loadSharePreview(backendPort, token) {
  return new Promise((resolve) => {
    const req = request(
      {
        host: '127.0.0.1',
        port: backendPort,
        path: `/api/v1/public/posts/${token}`,
        headers: { accept: 'application/json' },
      },
      (reply) => {
        const chunks = [];
        let length = 0;
        reply.on('data', (chunk) => {
          length += chunk.length;
          if (length > 65536) req.destroy();
          else chunks.push(chunk);
        });
        reply.on('error', () => resolve({ status: 503 }));
        reply.on('end', () => {
          if (reply.statusCode !== 200)
            return resolve({ status: reply.statusCode === 404 ? 404 : 503 });
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if (
              typeof data.content !== 'string' ||
              data.content.length > 500 ||
              typeof data.author_name !== 'string' ||
              !Array.isArray(data.images) ||
              data.images.length > 5
            )
              throw new Error();
            resolve({ status: 200, data });
          } catch {
            resolve({ status: 503 });
          }
        });
      },
    );
    req.setTimeout(10000, () => req.destroy());
    req.on('error', () => resolve({ status: 503 }));
    req.end();
  });
}

export function sharePreviewHTML(html, post, origin, token) {
  const title = post ? `${post.author_name}的拼單｜政缺一咖` : '貼文目前無法查看｜政缺一咖';
  const description = post ? post.content.slice(0, 160) : '連結可能已失效，或拼單已取消。';
  const url = `${origin}/s/${token}`;
  const first = post?.images?.[0];
  const image =
    first && /^[0-9a-f-]{36}$/.test(first.id)
      ? `${origin}/api/v1/public/posts/${token}/images/${first.id}`
      : `${origin}/app-icon.svg`;
  const meta = `<title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta name="robots" content="noindex,nofollow"><meta property="og:type" content="article"><meta property="og:site_name" content="政缺一咖"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(url)}"><meta property="og:image" content="${escape(image)}"><meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="${escape(url)}">`;
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(
      /<meta\b[^>]*(?:property|name)=["'](?:og:[^"']+|twitter:[^"']+|description)["'][^>]*>/gi,
      '',
    )
    .replace('</head>', `${meta}</head>`)
    .replace(
      '</body>',
      `<noscript><article><h1>${escape(title)}</h1><p>${escape(post?.content ?? description)}</p><a href="/sign-in">註冊／登入</a></article></noscript></body>`,
    );
}
