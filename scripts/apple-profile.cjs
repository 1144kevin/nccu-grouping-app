const { releaseProblems } = require('./release-config.cjs');

function validateProfile(value) {
  if (!value || !['simulator', 'device', 'release'].includes(value.profile))
    throw new Error('Choose simulator, device or release.');
  const url = new URL(value.api);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/api/v1')
    throw new Error('API must end in /api/v1 and contain no credentials, query or fragment.');
  if (value.profile === 'simulator' && value.api !== 'http://127.0.0.1:8000/api/v1')
    throw new Error('Simulator profile uses the Mac loopback API.');
  if (value.profile === 'device') {
    const parts = url.hostname.split('.').map(Number);
    const privateIP =
      parts.length === 4 &&
      parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) &&
      (parts[0] === 10 ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168));
    if (!privateIP || url.protocol !== 'https:' || url.port !== '8443')
      throw new Error(
        'Device profile requires https://PRIVATE_IPV4:8443/api/v1. Certificate trust is checked on iPhone.',
      );
  }
  if (value.profile === 'release') {
    const problems = releaseProblems(
      { scheme: 'nccugrouping', ios: { bundleIdentifier: 'com.nccugrouping.nccuGrouping' } },
      profileEnv(value),
    );
    if (problems.length) throw new Error(problems.join('\n'));
  }
  return { profile: value.profile, api: value.api };
}

function profileEnv(value) {
  return {
    EXPO_PUBLIC_CORE_API_ENABLED: 'true',
    EXPO_PUBLIC_CORE_DATA_MODE: 'supabase',
    EXPO_PUBLIC_API_BASE_URL: value.api,
    EXPO_PUBLIC_APP_PROFILE: value.profile,
    EXPO_PUBLIC_APPLE_INTAKE_ENABLED: 'true',
    // A normal build must never inherit the earlier stand-alone interview trial.
    EXPO_PUBLIC_APPLE_INTAKE_TRIAL: 'false',
    EAS_BUILD_PROFILE: '',
    CORE_RELEASE_CHECK: value.profile === 'release' ? 'true' : 'false',
    EXPO_NO_TELEMETRY: '1',
  };
}
function appleXcodeProblem(output) {
  const version = output?.match(/Xcode (\d+)\.(\d+)/);
  if (!version || Number(version[1]) < 27)
    return 'This App includes Apple intake SDK 27 APIs. Install/select full Xcode 27+ and complete its first launch (tested with Xcode 27.1).';
}
module.exports = { validateProfile, profileEnv, appleXcodeProblem };
