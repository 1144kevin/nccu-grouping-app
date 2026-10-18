const { releaseProblems } = require('./scripts/release-config.cjs');

module.exports = ({ config }) => {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  if (
    projectId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)
  ) {
    throw new Error('EXPO_PUBLIC_EAS_PROJECT_ID must be the Expo project UUID.');
  }
  const resolved = {
    ...config,
    extra: { ...config.extra, ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}) },
  };
  if (process.env.EAS_BUILD_PROFILE === 'production' || process.env.CORE_RELEASE_CHECK === 'true') {
    const problems = releaseProblems(resolved, process.env);
    if (problems.length)
      throw new Error(`iOS release configuration is incomplete:\n${problems.join('\n')}`);
  }
  return resolved;
};
