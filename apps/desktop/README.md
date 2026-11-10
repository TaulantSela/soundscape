# @soundscape/desktop

Electron shell that wraps the Soundscape Mixer web app and adds a tray icon with play/pause controls.

## What it loads

- Development (`npm run dev`): `SOUNDSCAPE_DEV_SERVER`, default `http://localhost:3000`. Start the web app first.
- Packaged app: `SOUNDSCAPE_APP_URL` if set, otherwise the production web app (`PRODUCTION_APP_URL` in `@soundscape/config`).

The window only ever shows that origin: links and navigation elsewhere open in the default browser, and only `http(s)` links are opened at all.

## Commands

```bash
npm run dev --workspace @soundscape/desktop     # compile, then open Electron against the dev server
npm run build --workspace @soundscape/desktop   # compile TypeScript to dist/
npm run dist --workspace @soundscape/desktop    # package installers into release/ with electron-builder
npm run lint --workspace @soundscape/desktop
```

Packaging is unsigned unless signing credentials are configured (see the electron-builder docs). If you launch Electron from a process that sets `ELECTRON_RUN_AS_NODE=1` (some editor extension hosts do), unset it first, or Electron starts as plain Node.

## Tray controls

- Show Mixer / Hide Mixer
- Toggle Play/Pause: sends `soundscape:toggle-play` to the page, which the web app handles through `window.soundscapeDesktop`
- Quit
