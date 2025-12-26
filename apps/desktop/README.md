# @soundscape/desktop

Electron shell that wraps the Soundscape Mixer web experience, adds a persistent tray icon, and exposes global play/pause controls.

## Environment

Create a `.env` alongside the Electron workspace or export shell variables:

```
SOUNDSCAPE_ENV=development
SOUNDSCAPE_APP_URL=http://localhost:3000
SOUNDSCAPE_API_URL=http://localhost:4000/api
SOUNDSCAPE_ASSET_URL=http://localhost:3000
SOUNDSCAPE_DEV_SERVER=http://localhost:3000
```

The `SOUNDSCAPE_DEV_SERVER` value determines which URL is loaded while the app is not packaged. In production builds the preload bridge uses `SOUNDSCAPE_APP_URL`.

## Commands

```bash
# Launch Electron with automatic restarts
npm run dev --workspace @soundscape/desktop

# Compile TypeScript to dist/
npm run build --workspace @soundscape/desktop

# Run linting
npm run lint --workspace @soundscape/desktop
```

## Tray Controls

The tray menu exposes:

- Show Mixer / Hide Mixer – toggles window visibility
- Toggle Play/Pause – sends a `soundscape:toggle-play` event to the renderer
- Quit – exits the Electron process

Renderer code can listen for the preload bridge in `window.soundscapeDesktop` to respond to play/pause requests or trigger them manually.
