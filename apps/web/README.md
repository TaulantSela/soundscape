# @soundscape/web

Next.js 16 app that delivers the Soundscape Mixer in the browser. It uses the shared audio library for sounds, presets and share links, Zustand for state, and Tailwind CSS for styling. The mixer itself needs no backend; accounts and uploaded sounds use Neon (Postgres + Managed Better Auth) and a private Vercel Blob store.

## Environment

Accounts and uploads need the project's server variables. Pull them from Vercel (the repo root is linked to the `soundscape-web` project):

```bash
vercel env pull apps/web/.env.local
```

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | Neon Postgres (`user_sounds`) |
| `NEON_AUTH_BASE_URL` | Managed Better Auth endpoint |
| `NEON_AUTH_COOKIE_SECRET` | Signs the session-data cookie (32+ random characters, different per environment) |
| `BLOB_READ_WRITE_TOKEN` | Private Blob store `soundscape-uploads`: signed upload and download URLs |

Local development and production currently share one database. Use throwaway accounts when testing and delete them afterwards.

The rest is optional; set it in `apps/web/.env.local` to override defaults:

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
npm run db:migrate --workspace @soundscape/web # apply db/migrations/*.sql once each
```

Safari refuses the auth cookies (`__Secure-…`, `Secure`) on plain `http://localhost`, so test sign-in locally in Chrome, or over HTTPS (a preview deployment).

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

## Accounts and uploaded sounds

- Sign-in is Managed Better Auth (`@neon/auth`): email and password, or Google. `app/api/auth/[...path]` proxies every auth call so the session cookie stays on this domain. Google is hidden inside the desktop app, because Google refuses to sign in from embedded browsers.
- Uploaded sounds are private: only their owner can list or play them. A shared mix keeps their ids (`u-<uuid>`) in the link; anyone else hears the mix without those layers, and the banner says so.
- Uploading takes three steps, because functions can't receive bodies over 4.5 MB:
  1. `POST /api/sounds/uploads` checks the type and size and reserves quota (atomically, per user), then returns a presigned `PUT` URL for exactly one pathname, size and content type. The type is the one Blob files that extension under (`.m4a` is `audio/mp4`), not the browser's name for it: Blob types files by extension and refuses an upload whose allowed types don't include that (Safari reports `.m4a` as `audio/x-m4a`).
  2. The browser `PUT`s the file straight to Blob, which enforces those limits itself.
  3. `POST /api/sounds/:id/complete` confirms the file with `head()` and adds it to the library. Unconfirmed reservations expire after 15 minutes.
- Playback asks `GET /api/sounds/:id/file` for a 15-minute signed URL and downloads straight from Blob. Uploads play from the beginning (built-in loops start at a random point, so layers don't line up the same way), and an upload that's on shows its position with scrubbing, Restart and ±15 s. The engine crossfades the end of each upload into its start, in place: the tail is blended into the first 0.3 s and repeats resume just after them (`loopStart`), so the first pass plays the real beginning and every repeat is seamless.
- Limits (shared with mobile, in `packages/audio-library/src/user-sounds.ts`): MP3, M4A, AAC or WAV; up to 50 MB and 10 minutes per file; 50 sounds and 200 MB per account. The browser decodes each file at 8 kHz before uploading it, to reject non-audio and over-long files early without holding full-rate samples.
- Memory: Web Audio plays a layer from decoded samples, about 23 MB per stereo minute at 48 kHz, so a ten-minute upload holds roughly 230 MB while it's on. The engine drops an upload's samples 30 seconds after its layer goes off but keeps the downloaded file, so switching it back on later only decodes again.
- Safari decodes AAC (M4A) very slowly when it needn't resample: a nine-minute 48 kHz file took 31 s at 48 kHz and 0.45 s at 47,999 Hz (MP3 and WAV don't have this problem). The engine decodes AAC 1 Hz below the context rate and copies the samples into a context-rate buffer, so they play 0.002% fast without a second resampling.

## Signing in from the native app

The app signs in with Neon Auth's OAuth provider (authorization code with PKCE) and calls this API with the access token.

- Neon setup (branch `main` of `soundscape-db`): the OAuth provider is enabled with login page `/auth/login`, consent page `/auth/consent` and the protected resource `https://soundscape-web-one.vercel.app/api`. The app is the public client "Soundscape app" (`FzpipYmjYIcdIDBZcPeUQLpbNQLMQmEF`, no secret), whose only redirect URI is `/auth/app-callback`. These live in Neon, not in this repo: change them with the Neon Console or API.
- The flow:
  1. The app opens `/auth/app-authorize?<authorize parameters>` in a sign-in browser. Neon's authorize endpoint answers with JSON rather than a redirect, so this route asks it and redirects to the login page it names.
  2. The login page signs in (or finds the session) and continues; the auth client attaches the signed `oauth_query` itself. Creating an account goes through the register page with the same query.
  3. The consent page shows the app and what it may do; Allow sends the browser to `/auth/app-callback?code=…`.
  4. `/auth/app-callback` redirects to `soundscape://auth/callback?code=…&state=…`, which the sign-in browser hands back to the app. Neon only accepts https redirect URIs for managed clients, hence the hop. PKCE makes an intercepted code useless.
  5. The app exchanges the code at Neon's token endpoint and sends `Authorization: Bearer <access token>` to `/api/sounds/*`. Access tokens last an hour; refresh tokens 30 days and rotate on each use.
- The API verifies those tokens in `lib/server/app-tokens.ts` (EdDSA, against Neon's JWKS) and checks the issuer and audience too, because every branch of the project shares signing keys. Bearer requests skip the Origin check: a browser on another site can't send our token.
- The login and consent pages send `Content-Security-Policy: frame-ancestors 'none'`.
