const test = require('node:test');
const assert = require('node:assert/strict');
const appConfig = require('../app.config.js');
const environment = process.env;
const names = [
  'EXPO_PUBLIC_APPLE_INTAKE_TRIAL',
  'EXPO_PUBLIC_APPLE_INTAKE_ENABLED',
  'EXPO_PUBLIC_CORE_API_ENABLED',
  'EXPO_PUBLIC_APP_PROFILE',
  'EAS_BUILD_PROFILE',
  'CORE_RELEASE_CHECK',
];
test('local interview trial cannot accidentally ship as a production or release build', () => {
  const saved = Object.fromEntries(names.map((name) => [name, environment[name]]));
  try {
    for (const name of names) delete environment[name];
    Object.assign(environment, {
      EXPO_PUBLIC_APPLE_INTAKE_TRIAL: 'true',
      EXPO_PUBLIC_APPLE_INTAKE_ENABLED: 'true',
      EXPO_PUBLIC_CORE_API_ENABLED: 'true',
      EXPO_PUBLIC_APP_PROFILE: 'device',
    });
    const config = { plugins: ['expo-notifications', 'expo-router'] };
    const output = appConfig({ config });
    assert.ok(!output.plugins.includes('expo-notifications'));
    assert.ok(output.plugins.includes('expo-router'));
    for (const [name, value] of [
      ['CORE_RELEASE_CHECK', 'true'],
      ['EAS_BUILD_PROFILE', 'production'],
      ['EXPO_PUBLIC_APP_PROFILE', 'release'],
    ]) {
      const previous = environment[name];
      environment[name] = value;
      assert.throws(() => appConfig({ config }), /cannot be used for a production build/);
      if (previous === undefined) delete environment[name];
      else environment[name] = previous;
    }
    environment.EXPO_PUBLIC_APPLE_INTAKE_ENABLED = 'false';
    assert.throws(() => appConfig({ config }), /requires Apple intake/);
  } finally {
    for (const name of names) {
      if (saved[name] === undefined) delete environment[name];
      else environment[name] = saved[name];
    }
  }
});
