# Soundscape Mixer

Soundscape Mixer is a cross-platform ambient audio tool that lets listeners blend layers (rain, waves, café murmur, brown noise and more) into a mix they can share with a link. The monorepo holds a Next.js web app, an Expo mobile app, an Electron desktop shell, an optional Express API, and the shared packages they all use.

## Workspace layout

- `packages/audio-library` – sound and preset definitions, mix helpers, share-link encoding, and the synthesizer that renders every sound
- `packages/config` – environment-aware configuration helpers used by every target
- `apps/web` – Next.js 15 web app (the main product)
- `apps/mobile` – Expo SDK 54 / React Native app
- `apps/desktop` – Electron shell around the web app, with tray controls
- `apps/api` – Express + Prisma REST API (optional; no client depends on it today)

## How sounds work

None of the sounds ship as audio files. Each one is synthesized from code in `packages/audio-library/src/synth`, rendered as a seamless loop (continuous textures are crossfaded at the loop point; discrete events wrap around it) and level-matched. The web app renders loops in a Web Worker and plays them with Web Audio; the mobile app renders each loop once and caches it as a WAV file.

To use a recording instead, add `file: { path: '/audio/<id>.mp3', format: 'mp3' }` to the sound in `packages/audio-library/src/sounds.ts` and serve the file from `apps/web/public/audio/` (or a CDN via `NEXT_PUBLIC_ASSET_URL`). Make sure you hold the rights to any recording you add.

## Sharing mixes

A shared mix travels inside the link, so sharing needs no server or database:

```
/mix?s=rain-shower:60,brown-noise:35&v=80
```

`s` lists `soundId:volumePercent` pairs and `v` is the master volume. Opening a link never overwrites the listener's own saved mix unless they choose **Keep this mix**. See `packages/audio-library/src/share.ts`.

## Prerequisites

- Node.js 22.12 or newer and npm 10+
- For the API only: PostgreSQL
- For mobile builds: Xcode and/or Android Studio (the app uses native modules, so build it with `expo run:ios` / `expo run:android`)

Install all dependencies from the repository root:

```bash
npm install
```

## Scripts

Run these from the repository root:

| Command | What it does |
| --- | --- |
| `npm run dev` | Build the shared packages, then start the web app on http://localhost:3000 |
| `npm run dev:mobile` | Build the shared packages, then start Expo |
| `npm run dev:desktop` | Build the shared packages, then open the desktop shell (expects the web app running) |
| `npm run dev:api` | Build the shared packages, then start the API (needs the API's `.env`) |
| `npm run build` | Build every workspace, shared packages first |
| `npm run test` | Run the unit tests (shared packages and API) |
| `npm run typecheck` | Type-check every workspace |
| `npm run lint` | Lint every workspace |

Each workspace README lists its own scripts and environment variables.

## Testing

Vitest covers the shared packages (mix logic, share links, synthesizer output and loop seams, config) and the API (Supertest, with Prisma mocked).

## License

MIT
