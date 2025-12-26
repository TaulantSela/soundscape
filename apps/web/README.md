# @soundscape/web

Next.js 14 application that delivers the Soundscape Mixer in the browser. It uses the shared audio library for sounds and presets, React Query for API requests, Zustand for local state, and Tailwind CSS for styling.

## Environment

Create a `.env.local` file inside `apps/web` with:

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_ASSET_URL=http://localhost:3000
NEXT_PUBLIC_ENV=development
```

Add optional values for `NEXT_PUBLIC_FEATURE_FLAGS` (JSON object) or CDN endpoints as needed.

## Commands

```bash
# Start the development server with hot reload
npm run dev --workspace @soundscape/web

# Run linting (Next.js + ESLint)
npm run lint --workspace @soundscape/web

# Type-check the project
npm run typecheck --workspace @soundscape/web

# Build a production bundle
npm run build --workspace @soundscape/web
```

## Features

- Mixer UI with sound toggles, volume sliders, master control, and keyboard shortcuts
- Built-in presets sourced from the audio library
- Share flow that calls the API and copies a shareable link to the clipboard
- Typed routes enabled via `experimental.typedRoutes`
- Shared mix detail page at `/mix/[id]`

When running inside the Electron shell, the app receives tray toggle events via the `soundscapeDesktop` bridge exposed in the preload script.
