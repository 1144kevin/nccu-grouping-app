const { isIP } = require('node:net');
const { validateProfile } = require('./apple-profile.cjs');

function privateIP(value) {
  if (isIP(value) !== 4) return false;
  const [a, b] = value.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
function validateExpoConnection(value) {
  if (!value || !privateIP(value.host) || !Array.isArray(value.clients) ||
      !value.clients.length || value.clients.length > 8 ||
      new Set(value.clients).size !== value.clients.length ||
      value.clients.some(client => !privateIP(client) || client === value.host) ||
      !Number.isFinite(Date.parse(value.leaf_expires)) || Date.parse(value.leaf_expires) <= Date.now())
    throw new Error('A current private Windows/iPhone connection and valid TLS certificate are required.');
  validateProfile({ profile: 'device', api: value.api });
  if (new URL(value.api).hostname !== value.host)
    throw new Error('API host differs from the checked Windows network.');
  return value;
}
function expoGoEnv(connection, inherited = process.env) {
  validateExpoConnection(connection);
  const env = Object.fromEntries(Object.entries(inherited).filter(([key]) =>
    !/^(EXPO_PUBLIC_|EXPO_PACKAGER_|REACT_NATIVE_PACKAGER_|EAS_BUILD_PROFILE$|CORE_RELEASE_CHECK$|EXPO_OFFLINE$)/i.test(key)));
  return {
    ...env,
    EXPO_PUBLIC_CORE_API_ENABLED: 'true',
    EXPO_PUBLIC_CORE_DATA_MODE: 'supabase',
    EXPO_PUBLIC_API_BASE_URL: connection.api,
    EXPO_PUBLIC_APP_PROFILE: 'device',
    EXPO_PUBLIC_APPLE_INTAKE_ENABLED: 'false',
    EXPO_PUBLIC_APPLE_INTAKE_TRIAL: 'false',
    EAS_BUILD_PROFILE: '',
    CORE_RELEASE_CHECK: 'false',
    EXPO_PACKAGER_PROXY_URL: `http://${connection.host}:8081`,
    EXPO_NO_DOTENV: '1',
    EXPO_NO_TELEMETRY: '1',
  };
}
module.exports = { validateExpoConnection, expoGoEnv };
