import assert from 'node:assert/strict';
import { test } from 'node:test';
import { webAppOrigin } from './web-app-origin.mjs';

test('supports exact custom domains and existing quick tunnel origins', () => {
  for (const origin of [
    'https://nccugrouping.com',
    'https://app.nccugrouping.com',
    'https://campus-fixture.trycloudflare.com',
  ])
    assert.equal(webAppOrigin(origin), origin);
});

test('rejects wildcard, local, credential-bearing and non-origin configurations', () => {
  for (const value of [
    'http://nccugrouping.com',
    'https://*.nccugrouping.com',
    'https://localhost',
    'https://app.localhost',
    'https://127.0.0.1',
    'https://192.168.1.2',
    'https://[::1]',
    'https://nccugrouping.com:8443',
    'https://user:pass@nccugrouping.com',
    'https://nccugrouping.com/auth/callback',
    'https://nccugrouping.com?redirect=elsewhere',
    'https://nccugrouping.com#fragment',
  ])
    assert.throws(() => webAppOrigin(value), value);
});
