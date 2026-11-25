# 🌧️🌊🔥 Soundscape Mixer

Blend ambient layers (rain, waves, café murmur, a fireplace, brown noise and
more) into a mix for focus or sleep, then share it with a link. Soundscape
Mixer runs in the browser, on iOS and Android, and on the desktop with tray
controls.

**▶ [Open the mixer →](https://soundscape-web-one.vercel.app)** — no account
needed. Switch on a few layers and press Space.

None of the built-in sounds is a recording. Each one is synthesized from code,
so there are no audio files to license, host or download. A shared mix is just
a URL: nothing about it is stored on a server.

## Features

- **12 synthesized sounds** in four groups: nature (rain, thunder, ocean,
  birds, wind), urban (café, night train, city hum), home (fireplace, keyboard
  typing) and tones (lo-fi piano, brown noise). Each has its own volume, plus
  a master volume.
- **6 presets**: Focus Flow, Deep Work, Cozy Night, Sleep Drift, Train Ride
  and Reading Nook. Applying one replaces the current mix.
- **Share links** that carry the whole mix. The web app copies the link to
  the clipboard (or opens the share sheet on touch devices); the mobile app
  opens the native share sheet.
- **Your own sounds**: sign in with Google or email and password, then upload
  MP3, M4A, AAC or WAV files and layer them with the built-in sounds. Uploads
  are private to your account and show their position with scrubbing,
  Restart and ±15 s.
- **Keyboard shortcuts** on the web: Space plays and pauses, 1–9 toggle the
  first nine sounds (by physical key, so they work on any layout).
- **Your mix is remembered** between visits (localStorage on the web,
  AsyncStorage on mobile). Playback always starts stopped.
- **Background playback on mobile**: the mix keeps playing with the screen
  locked, and the lock screen or headphones pause and resume the whole mix.
- **Desktop tray**: Show/Hide Mixer, Play/Pause and Quit.

## Sharing mixes

A shared mix travels inside the link:

```
/mix?s=rain-shower:60,brown-noise:35&v=80
```

`s` lists `soundId:volumePercent` pairs, `v` is the master volume and an
optional `n` names the mix. Unknown sounds, duplicates and malformed volumes
are dropped. Opening a link never overwrites the listener's own saved mix
unless they choose **Keep this mix**.

Uploaded sounds travel in the link as `u-<uuid>` ids, but only their owner
can play them: everyone else hears the mix without those layers, and the
banner says so. See `packages/audio-library/src/share.ts`.

## How it works

1. **Sounds** (`packages/audio-library/src/synth`). Every sound is a generator
   rendered as a seamless 12–30 s loop: continuous textures (noise, wind,
   waves) are crossfaded at the loop point, discrete events (drops, chirps,
   keys, notes) wrap around it, and each loop is normalized to a target
   loudness so the layers are level-matched.
2. **Web** (`apps/web`, Next.js 16, Zustand, Tailwind CSS). Loops are rendered
   in a Web Worker so the UI never stalls, then each active sound plays as a
   looping `AudioBufferSourceNode` through its own gain, a master gain and a
   gentle limiter.
3. **Mobile** (`apps/mobile`, Expo SDK 54 / React Native 0.81). Each sound is
   rendered the first time it is switched on and cached as a WAV file, then
   played with one looping `expo-audio` player per layer.
4. **Desktop** (`apps/desktop`, Electron). Wraps the web app: the dev server
   in development, the production site when packaged. The tray's Play/Pause
   reaches the page through `window.soundscapeDesktop`.
5. **Accounts and uploads** (web API routes). Sign-in is Neon Auth (Managed
   Better Auth), proxied through `app/api/auth` so the session cookie stays on
   the site. Uploads are listed in Neon Postgres and stored in a private
   Vercel Blob store. An upload takes three steps: the server checks the type
   and size and reserves quota, the browser `PUT`s the file straight to Blob
   with a presigned URL, and the server confirms it. Playback fetches a
   15-minute signed URL.
6. **Mobile sign-in** uses the website's sign-in pages as an OAuth provider
   (authorization code with PKCE) and calls the same `/api/sounds/*` routes
   with a bearer token kept in the Keychain/Keystore.
7. **API** (`apps/api`, Express + Prisma, optional). Stores mixes; no client
   depends on it today.

Upload limits are shared by web and mobile (`packages/audio-library/src/user-sounds.ts`):
up to 50 MB and 10 minutes per file, 50 sounds and 200 MB per account.

To use a recording instead of a synthesized sound, add
`file: { path: '/audio/<id>.mp3', format: 'mp3' }` to the sound in
`packages/audio-library/src/sounds.ts` and serve the file from
`apps/web/public/audio/` (or a CDN via `NEXT_PUBLIC_ASSET_URL`). Make sure you
hold the rights to any recording you add.

## Workspace layout

- `packages/audio-library`: sound and preset definitions, mix helpers, share-link encoding, upload limits, and the synthesizer that renders every sound
- `packages/config`: environment-aware configuration helpers used by every target
- `apps/web`: Next.js 16 web app (the main product)
- `apps/mobile`: Expo SDK 54 / React Native app
- `apps/desktop`: Electron shell around the web app, with tray controls
- `apps/api`: Express + Prisma REST API (optional; no client depends on it today)

## Run locally

Prerequisites:

- Node.js 22.12 or newer and npm 10+
- For the API only: PostgreSQL
- For mobile builds: Xcode and/or Android Studio (the app uses native modules, so build it with `expo run:ios` / `expo run:android`, not Expo Go)

Install all dependencies from the repository root:

```bash
npm install
```

Then run these from the root:

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

The mixer itself runs without any configuration. Accounts and uploads need a
Neon project with Neon Auth, a private Vercel Blob store and these variables in
`apps/web/.env.local`:

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | Neon Postgres (uploaded sounds) |
| `NEON_AUTH_BASE_URL` | Neon Auth endpoint |
| `NEON_AUTH_COOKIE_SECRET` | Signs the session cookie (32+ random characters) |
| `BLOB_READ_WRITE_TOKEN` | Private Vercel Blob store for uploads |

Then create the uploads table once with
`npm run db:migrate --workspace @soundscape/web`.

Production has its own database and Neon Auth. Preview deployments and the
Development environment use a separate dev database, `soundscape-dev`, with its
own Neon Auth accounts, so with the project linked, `vercel env pull
apps/web/.env.local` points local work at it and nothing you do locally reaches
production data. Sign up for a test account there; production accounts don't
exist on it.

`npm run db:migrate` only runs on a database marked as a disposable dev
database ([`apps/web/scripts/require-dev-db.mjs`](apps/web/scripts/require-dev-db.mjs)),
so it can't migrate production from a laptop. `soundscape-dev` is marked; to
mark a new dev database (never production), run this once against it, e.g. in
Neon's SQL editor:

```sql
COMMENT ON DATABASE neondb IS 'soundscape:disposable';
```

Production builds apply new migrations themselves: the Vercel build runs
[`apps/web/scripts/migrate-on-production-build.mjs`](apps/web/scripts/migrate-on-production-build.mjs)
before `next build` on `VERCEL_ENV=production`, so a merged PR's migrations land
with its code. A failing migration fails the build and the current version stays
live. Keep migrations backward-compatible (add first, remove in a later
release): the previous version keeps serving while the build runs. Previews
don't migrate: when a PR adds a migration, run `npm run db:migrate --workspace
@soundscape/web` against the dev database so its preview works.

Safari refuses the secure auth cookies on plain `http://localhost`, so test
sign-in locally in Chrome or on a preview deployment. Each workspace README
lists its own scripts and optional variables (`NEXT_PUBLIC_*` for the web,
`EXPO_PUBLIC_*` for mobile, `JWT_*` and `FRONTEND_URL` for the API).

Vitest covers the shared packages (mix logic, share links, synthesizer output
and loop seams, upload limits, config) and the API (Supertest, with Prisma
mocked).

## Status

- **Web** is live at the link above.
- **Mobile** isn't on the App Store or Google Play: build it yourself with
  `npm run ios --workspace @soundscape/mobile` (or `android`).
- **Desktop** has no published installers: `npm run dist --workspace @soundscape/desktop`
  packages unsigned ones into `apps/desktop/release/`. Google sign-in is hidden
  there, because Google refuses to sign in from embedded browsers; use email
  and password instead.
- **API**: only the health check and stored mixes work; the auth, sound and
  preset routes return `501 Not Implemented`.
