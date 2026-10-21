const { withInfoPlist, withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withConnectedNetwork(config) {
  if (process.env.EXPO_PUBLIC_CORE_API_ENABLED !== 'true') return config;
  const profile = process.env.EXPO_PUBLIC_APP_PROFILE;
  const release =
    profile === 'release' ||
    process.env.CORE_RELEASE_CHECK === 'true' ||
    process.env.EAS_BUILD_PROFILE === 'production';
  if (process.env.EXPO_PUBLIC_APPLE_INTAKE_TRIAL === 'true') {
    config = withEntitlementsPlist(config, (value) => {
      delete value.modResults['aps-environment'];
      return value;
    });
  }
  return withInfoPlist(config, (value) => {
    // Expo's generated defaults can enable arbitrary loads even when app.json does not.
    // Device/release use HTTPS only; simulator permits only loopback HTTP for the local API.
    value.modResults.NSAppTransportSecurity = {
      NSAllowsArbitraryLoads: false,
      NSAllowsArbitraryLoadsInWebContent: false,
      NSAllowsLocalNetworking: !release,
      ...(!release && profile !== 'device'
        ? {
            NSExceptionDomains: {
              '127.0.0.1': { NSExceptionAllowsInsecureHTTPLoads: true },
              localhost: { NSExceptionAllowsInsecureHTTPLoads: true },
            },
          }
        : {}),
    };
    return value;
  });
};
