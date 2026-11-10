import type { ConfigContext, ExpoConfig } from '@expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Soundscape',
  slug: 'soundscape-mobile',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  scheme: 'soundscape',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.taulantsela.soundscape',
    infoPlist: {
      // Keep the mix playing with the screen locked or the app in the background.
      UIBackgroundModes: ['audio']
    }
  },
  android: {
    package: 'com.taulantsela.soundscape',
    // expo-audio's manifest asks for the microphone; this app only plays audio.
    blockedPermissions: ['android.permission.RECORD_AUDIO']
  },
  plugins: [
    ['expo-audio', { microphonePermission: false, recordAudioAndroid: false }],
    // Xcode 27 rejects the iOS 13.4 minimum some pod resource bundles still declare.
    './plugins/with-pod-resource-deployment-target',
  ],
  extra: {
    environment: process.env.EXPO_PUBLIC_ENV ?? process.env.NODE_ENV ?? 'development',
    appUrl: process.env.EXPO_PUBLIC_APP_URL,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_URL,
    assetBaseUrl: process.env.EXPO_PUBLIC_ASSET_URL,
    cdnBucketUrl: process.env.EXPO_PUBLIC_CDN_URL,
    featureFlags: process.env.EXPO_PUBLIC_FEATURE_FLAGS
  }
});
