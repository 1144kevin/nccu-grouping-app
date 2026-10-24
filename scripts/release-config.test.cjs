const test = require('node:test');
const assert = require('node:assert/strict');
const { releaseProblems } = require('./release-config.cjs');
const config = {
  scheme: 'nccugrouping',
  ios: { bundleIdentifier: 'com.nccugrouping.nccuGrouping' },
};
const env = {
  EXPO_PUBLIC_CORE_API_ENABLED: 'true',
  EXPO_PUBLIC_CORE_DATA_MODE: 'supabase',
  EXPO_PUBLIC_API_BASE_URL: 'https://api.team-domain.org/api/v1',
};
test('release refuses demo mode, localhost, LAN addresses, credentials and ATS bypass', () => {
  for (const address of [
    '',
    'http://localhost:8000/api/v1',
    'https://127.0.0.1/api/v1',
    'https://192.168.1.1/api/v1',
    'https://[::1]/api/v1',
    'https://api.local/api/v1',
    'https://x:private@api.team-domain.org/api/v1',
    'https://api.team-domain.org/api/v1?token=x',
  ]) {
    assert.ok(
      releaseProblems(config, { ...env, EXPO_PUBLIC_API_BASE_URL: address }).length,
      address,
    );
  }
  assert.ok(releaseProblems(config, { ...env, EXPO_PUBLIC_CORE_API_ENABLED: 'false' }).length);
  assert.ok(
    releaseProblems(
      {
        ...config,
        ios: {
          ...config.ios,
          infoPlist: { NSAppTransportSecurity: { NSAllowsArbitraryLoads: true } },
        },
      },
      env,
    ).length,
  );
  assert.deepEqual(releaseProblems(config, env), []);
});
test('dynamic app config retains existing settings and maps only a valid Expo project ID', () => {
  const appConfig = require('../app.config.js');
  const saved = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  try {
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID = '00000000-0000-4000-8000-000000000001';
    assert.equal(appConfig({ config }).extra.eas.projectId, process.env.EXPO_PUBLIC_EAS_PROJECT_ID);
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID = 'not-an-id';
    assert.throws(() => appConfig({ config }));
  } finally {
    if (saved === undefined) delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    else process.env.EXPO_PUBLIC_EAS_PROJECT_ID = saved;
  }
});

test('connected build enables speech microphone but removes unused camera/background audio', () => {
  const appConfig = require('../app.config.js');
  const saved = process.env.EXPO_PUBLIC_CORE_API_ENABLED;
  const input = {
    ...config,
    plugins: [
      ['expo-audio', { microphonePermission: 'demo' }],
      ['expo-image-picker', { cameraPermission: 'demo' }],
    ],
  };
  try {
    process.env.EXPO_PUBLIC_CORE_API_ENABLED = 'true';
    const value = appConfig({ config: input });
    assert.ok(value.plugins[0][1].microphonePermission.includes('口述'));
    assert.ok(value.ios.infoPlist.NSSpeechRecognitionUsageDescription);
    assert.equal(value.plugins[0][1].enableBackgroundPlayback, false);
    assert.equal(value.plugins[1][1].cameraPermission, false);
    process.env.EXPO_PUBLIC_CORE_API_ENABLED = 'false';
    assert.equal(appConfig({ config: input }).plugins[0][1].microphonePermission, 'demo');
  } finally {
    if (saved === undefined) delete process.env.EXPO_PUBLIC_CORE_API_ENABLED;
    else process.env.EXPO_PUBLIC_CORE_API_ENABLED = saved;
  }
});

test('device build declares local-network purpose without relaxing ATS', () => {
  const appConfig = require('../app.config.js');
  const saved = process.env.EXPO_PUBLIC_APP_PROFILE;
  try {
    process.env.EXPO_PUBLIC_APP_PROFILE = 'device';
    const value = appConfig({ config });
    assert.ok(value.ios.infoPlist.NSLocalNetworkUsageDescription);
    assert.equal(value.ios.infoPlist.NSAppTransportSecurity, undefined);
  } finally {
    if (saved === undefined) delete process.env.EXPO_PUBLIC_APP_PROFILE;
    else process.env.EXPO_PUBLIC_APP_PROFILE = saved;
  }
});
