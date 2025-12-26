# @soundscape/mobile

Expo-managed React Native app that mirrors the Soundscape Mixer experience on iOS and Android. It shares presets and audio metadata with the web client and persists the mixer state locally with AsyncStorage.

## Environment

Set Expo runtime variables (in `app.config.ts` or via the Expo CLI) before starting the app:

```
EXPO_PUBLIC_ENV=development
EXPO_PUBLIC_APP_URL=http://localhost:3000
EXPO_PUBLIC_API_URL=http://localhost:4000/api
EXPO_PUBLIC_ASSET_URL=http://localhost:3000
```

## Commands

```bash
# Start the Expo dev server
npm run start --workspace @soundscape/mobile

# Run TypeScript checks
npm run typecheck --workspace @soundscape/mobile

# Lint the source
npm run lint --workspace @soundscape/mobile
```

## Capabilities

- Sound toggle and volume controls powered by shared audio helpers
- Master volume slider and preset chips
- Mix persistence via AsyncStorage
- Share flow that calls the API, then opens the native share sheet with a generated URL
- Audio playback handled by `expo-av`; assets are resolved through the shared config helper `buildAssetUrl`

When pointing to a production API, ensure the asset base URL exposes static audio files so the player can stream loops.
