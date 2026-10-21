const { releaseProblems } = require('./scripts/release-config.cjs');

module.exports = ({ config }) => {
  if (process.env.EXPO_PUBLIC_APPLE_INTAKE_TRIAL === 'true' &&
      (process.env.CORE_RELEASE_CHECK === 'true' || process.env.EAS_BUILD_PROFILE === 'production' || process.env.EXPO_PUBLIC_APP_PROFILE === 'release')) {
    throw new Error('The local Apple intake trial cannot be used for a production build.');
  }
  if (process.env.EXPO_PUBLIC_APPLE_INTAKE_TRIAL === 'true' &&
      (process.env.EXPO_PUBLIC_APPLE_INTAKE_ENABLED !== 'true' || process.env.EXPO_PUBLIC_CORE_API_ENABLED !== 'true')) {
    throw new Error('The local Apple intake trial requires Apple intake and the connected app shell.');
  }
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  const privateDevice = process.env.EXPO_PUBLIC_CORE_API_ENABLED === 'true' &&
    process.env.EXPO_PUBLIC_APP_PROFILE === 'device' &&
    process.env.CORE_RELEASE_CHECK !== 'true' && process.env.EAS_BUILD_PROFILE !== 'production';
  if (
    projectId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)
  ) {
    throw new Error('EXPO_PUBLIC_EAS_PROJECT_ID must be the Expo project UUID.');
  }
  const resolved = {
    ...config,
    ios: {
      ...config.ios,
      ...(process.env.EXPO_PUBLIC_APP_PROFILE === 'device'
        ? {
            infoPlist: {
              ...config.ios?.infoPlist,
              NSLocalNetworkUsageDescription: '連線至你指定的測試電腦，以測試登入、拼單與聊天。',
            },
          }
        : {}),
    },
    plugins: [
      ...(config.plugins ?? []).filter((plugin) => {
        const name = Array.isArray(plugin) ? plugin[0] : plugin;
        return !((process.env.EXPO_PUBLIC_APPLE_INTAKE_TRIAL === 'true' || privateDevice) && name === 'expo-notifications');
      }).map((plugin) => {
        const name = Array.isArray(plugin) ? plugin[0] : plugin;
        const options = Array.isArray(plugin) ? plugin[1] : {};
        if (process.env.EXPO_PUBLIC_CORE_API_ENABLED !== 'true') return plugin;
        if (name === 'expo-audio')
          return [
            name,
            {
              ...options,
              microphonePermission: false,
              recordAudioAndroid: false,
              enableBackgroundRecording: false,
              enableBackgroundPlayback: false,
            },
          ];
        if (name === 'expo-image-picker')
          return [
            name,
            {
              ...options,
              photosPermission: '允許政缺一咖選取照片加入拼單。',
              cameraPermission: false,
              microphonePermission: false,
            },
          ];
        return plugin;
      }),
      './plugins/with-connected-network.cjs',
    ],
    extra: { ...config.extra, ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}) },
  };
  if (process.env.EAS_BUILD_PROFILE === 'production' || process.env.CORE_RELEASE_CHECK === 'true') {
    const problems = releaseProblems(resolved, process.env);
    if (problems.length)
      throw new Error(`iOS release configuration is incomplete:\n${problems.join('\n')}`);
  }
  return resolved;
};
