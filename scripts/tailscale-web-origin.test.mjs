import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tailscaleWebOrigin } from './tailscale-web-origin.mjs';

test('uses the connected device DNS name, keeping the stable HTTPS origin', () => {
  assert.equal(
    tailscaleWebOrigin({ BackendState: 'Running', Self: { DNSName: 'campus.fixture.ts.net.' } }),
    'https://campus.fixture.ts.net',
  );
});

test('does not invent a hostname before login or accept a foreign or malformed DNS name', () => {
  for (const status of [
    null,
    { BackendState: 'NeedsLogin' },
    { BackendState: 'Stopped', Self: { DNSName: 'campus.fixture.ts.net.' } },
    { BackendState: 'Running', Self: {} },
    { BackendState: 'Running', Self: { DNSName: 'elsewhere.com.' } },
    { BackendState: 'Running', Self: { DNSName: 'user:pass@campus.fixture.ts.net.' } },
    { BackendState: 'Running', Self: { DNSName: '*.fixture.ts.net.' } },
  ])
    assert.throws(() => tailscaleWebOrigin(status));
});
