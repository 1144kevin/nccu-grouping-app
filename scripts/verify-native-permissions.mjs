// Runs Expo config plugins in memory: no native project generation or network access.
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const profile of ['simulator', 'device', 'release']) {
  const result = spawnSync(
    process.execPath,
    [resolve(root, 'node_modules/expo/bin/cli'), 'config', '--type', 'introspect', '--json'],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
      env: {
        ...process.env,
        EXPO_OFFLINE: '1',
        EXPO_NO_TELEMETRY: '1',
        CORE_RELEASE_CHECK: 'false',
        EAS_BUILD_PROFILE: '',
        EXPO_PUBLIC_CORE_API_ENABLED: 'true',
        EXPO_PUBLIC_CORE_DATA_MODE: 'supabase',
        EXPO_PUBLIC_APPLE_INTAKE_TRIAL: 'false',
        EXPO_PUBLIC_APP_PROFILE: profile,
        EXPO_PUBLIC_API_BASE_URL:
          profile === 'simulator'
            ? 'http://127.0.0.1:8000/api/v1'
            : 'https://api.team-domain.org/api/v1',
      },
    },
  );
  if (result.status !== 0)
    throw new Error('Expo config introspection failed; no native build was started.');
  const config = JSON.parse(result.stdout);
  const plist = config._internal?.modResults?.ios?.infoPlist;
  assert.ok(plist, 'Expected generated iOS Info.plist configuration');
  assert.equal(plist.NSMicrophoneUsageDescription, undefined);
  assert.equal(plist.NSCameraUsageDescription, undefined);
  assert.ok(plist.NSPhotoLibraryUsageDescription);
  assert.ok(plist.NSLocationWhenInUseUsageDescription);
  if (profile === 'device') assert.ok(plist.NSLocalNetworkUsageDescription);
  if (profile === 'device')
    assert.equal(config._internal?.modResults?.ios?.entitlements?.['aps-environment'], undefined);
  assert.ok(!plist.UIBackgroundModes?.includes('audio'));
  assert.ok(!plist.NSAppTransportSecurity?.NSAllowsArbitraryLoads);
  assert.ok(!plist.NSAppTransportSecurity?.NSAllowsArbitraryLoadsInWebContent);
  if (profile === 'release') {
    assert.equal(plist.NSAppTransportSecurity?.NSAllowsLocalNetworking, false);
    assert.equal(plist.NSAppTransportSecurity?.NSExceptionDomains, undefined);
  }
  if (profile === 'device')
    assert.equal(plist.NSAppTransportSecurity?.NSExceptionDomains, undefined);
  if (profile === 'simulator')
    assert.deepEqual(Object.keys(plist.NSAppTransportSecurity.NSExceptionDomains).sort(), [
      '127.0.0.1',
      'localhost',
    ]);
  console.log(
    'Native permission introspection passed: photos/location/local network, no camera/mic/background audio or ATS bypass. No build, upload or trust changes.',
  );
}
