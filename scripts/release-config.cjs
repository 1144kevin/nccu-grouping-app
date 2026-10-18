const IOS_CALLBACK = 'nccugrouping://auth/callback';

function releaseProblems(config, env) {
  const problems = [];
  if (
    env.EXPO_PUBLIC_CORE_API_ENABLED !== 'true' ||
    env.EXPO_PUBLIC_CORE_DATA_MODE !== 'supabase'
  ) {
    problems.push('Release must explicitly enable the Supabase core API mode.');
  }
  try {
    const url = new URL(env.EXPO_PUBLIC_API_BASE_URL ?? '');
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/api/v1' ||
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host === '::1' ||
      /^[0-9.]+$/.test(host) ||
      host.includes(':') ||
      !host.includes('.') ||
      /\.(local|test|invalid|example)$/.test(host)
    ) {
      problems.push(
        'Release API needs an HTTPS DNS address ending in /api/v1, without credentials, query or fragment.',
      );
    }
  } catch {
    problems.push('Set EXPO_PUBLIC_API_BASE_URL to the actual reachable HTTPS API before release.');
  }
  if (config.scheme !== 'nccugrouping') problems.push(`App scheme must match ${IOS_CALLBACK}.`);
  if (!config.ios?.bundleIdentifier) problems.push('An iOS bundle identifier is required.');
  const plist = config.ios?.infoPlist ?? {};
  const ats = plist.NSAppTransportSecurity ?? {};
  if (ats.NSAllowsArbitraryLoads || ats.NSAllowsArbitraryLoadsInWebContent)
    problems.push('Do not bypass App Transport Security for release.');
  return problems;
}

module.exports = { releaseProblems, IOS_CALLBACK };
