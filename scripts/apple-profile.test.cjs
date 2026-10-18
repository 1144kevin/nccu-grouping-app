const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProfile, profileEnv } = require('./apple-profile.cjs');
test('profiles distinguish simulator, private TLS device and future cloud release', () => {
  for (const value of [
    { profile: 'simulator', api: 'http://127.0.0.1:8000/api/v1' },
    { profile: 'device', api: 'https://192.168.1.10:8443/api/v1' },
    { profile: 'release', api: 'https://api.team-domain.org/api/v1' },
  ])
    assert.deepEqual(validateProfile(value), value);
  assert.equal(
    profileEnv({ profile: 'release', api: 'https://api.team-domain.org/api/v1' })
      .CORE_RELEASE_CHECK,
    'true',
  );
});
test('device profile rejects cleartext, public hosts, missing TLS port and leaked secrets', () => {
  for (const api of [
    'http://192.168.1.10:8443/api/v1',
    'https://8.8.8.8:8443/api/v1',
    'https://192.168.1.10/api/v1',
    'https://u:secret@192.168.1.10:8443/api/v1',
    'https://192.168.1.10:8443/api/v1?token=secret',
  ])
    assert.throws(() => validateProfile({ profile: 'device', api }));
  assert.throws(() =>
    validateProfile({ profile: 'release', api: 'https://192.168.1.10:8443/api/v1' }),
  );
});
