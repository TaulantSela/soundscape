# @soundscape/web

Next.js 15 app that delivers the Soundscape Mixer in the browser. It uses the shared audio library for sounds, presets and share links, Zustand for state, and Tailwind CSS for styling. It needs no backend.

## Environment

Everything is optional. Create `apps/web/.env.local` only to override defaults:

```
# Origin used in share links. Defaults to the site the visitor is on.
NEXT_PUBLIC_APP_URL=https://soundscape-web-one.vercel.app
# Where recorded loops are served from, if any sound has a `file`.
NEXT_PUBLIC_ASSET_URL=https://cdn.example.com
NEXT_PUBLIC_FEATURE_FLAGS={"example":true}
```

Do not add fallbacks for these in `next.config.mjs`: `NEXT_PUBLIC_*` values are baked into the build, so a fallback such as `http://localhost:3000` ends up in production.

## Commands

```bash
npm run dev --workspace @soundscape/web        # development server
npm run build --workspace @soundscape/web      # production build
npm run lint --workspace @soundscape/web
npm run typecheck --workspace @soundscape/web
```

Build the shared packages first (`npm run build:packages` at the root); `npm run dev` at the root does both.

## How playback works

- `lib/mixer-audio-engine.ts` plays each active sound as a looping `AudioBufferSourceNode` (gapless, unlike `<audio loop>`), through a per-sound gain, a master gain and a gentle limiter. Volume changes ramp from the current value, and pausing fades out and suspends the audio context.
- The audio context is created by `engine.unlock()`, which click and key handlers call synchronously, because Safari only starts audio from a user gesture.
- Synthesized loops are rendered in a Web Worker (`workers/synth.worker.ts`) so the UI never stalls.

## Features

- Sound toggles (switching a sound on starts playback and restores its last volume), volume sliders, master volume
- Built-in presets that replace the current mix
- Keyboard shortcuts: Space to play/pause, 1–9 to toggle sounds (by physical key, so they work on any layout)
- Share links that copy to the clipboard (or open the share sheet on touch devices) and open at `/mix`
- The mix is saved to localStorage; playback always starts stopped after a reload
- Inside the Electron shell, the tray's Play/Pause reaches the page through `window.soundscapeDesktop`
