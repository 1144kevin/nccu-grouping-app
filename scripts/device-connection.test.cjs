const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { validateDeviceConnection } = require('./device-connection.cjs');
const { profileEnv } = require('./apple-profile.cjs');
const ca = Buffer.from('synthetic-public-ca');
const good = {
  format: 'nccu-device-link-v1', api: 'https://192.168.1.10:8443/api/v1',
  google_callback: 'nccugrouping://auth/callback', ca_file: 'ca.cer',
  ca_sha256: createHash('sha256').update(ca).digest('hex'), leaf_expires: '2035-01-01T00:00:00Z',
};
test('a verified public handoff configures a normal device app, never the local trial', () => {
  const result = validateDeviceConnection(good, ca, Date.parse('2030-01-01'));
  assert.equal(result.api, good.api);
  const env = profileEnv(result);
  assert.equal(env.EXPO_PUBLIC_APPLE_INTAKE_TRIAL, 'false');
  assert.equal(env.EXPO_PUBLIC_APPLE_INTAKE_ENABLED, 'true');
  assert.equal(env.EXPO_PUBLIC_CORE_DATA_MODE, 'supabase');
});
test('tampering, expiry, campus IPs, callback injection and secret fields are refused', () => {
  for (const patch of [
    { ca_sha256: '0'.repeat(64) }, { leaf_expires: '2000-01-01T00:00:00Z' },
    { api: 'https://140.119.124.78:8443/api/v1' }, { google_callback: 'evil://callback' },
    { ca_file: '../server-key.pem' }, { SUPABASE_SERVICE_ROLE_KEY: 'never-import' },
    { api: 'https://user:secret@192.168.1.10:8443/api/v1' },
  ]) assert.throws(() => validateDeviceConnection({ ...good, ...patch }, ca));
  assert.throws(() => validateDeviceConnection(good, Buffer.from('different-ca')));
});
