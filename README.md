# Soundscape Mixer

Soundscape Mixer is a cross-platform ambient audio tool that lets listeners blend curated layers into a shareable mix. The monorepo hosts the Express API, a Next.js web client, an Expo mobile app, and an Electron desktop shell that all share the same domain packages for sound metadata and configuration.

## Workspace Layout

- `apps/api` – Express + Prisma REST API
- `apps/web` – Next.js 14 web experience with typed routes
- `apps/mobile` – Expo/React Native client with offline persistence
- `apps/desktop` – Electron shell that wraps the web UI and exposes tray controls
- `packages/audio-library` – Shared sound definitions, presets, and mix helpers
- `packages/config` – Environment-aware configuration helpers used by every target

## Prerequisites

- Node.js 18.18 or newer and npm 9+
- PostgreSQL for the API workspace (development can use a local instance)
- Expo CLI (optional) for running the mobile app on devices or emulators
- Xcode or Android Studio for native simulators, if desired

Install all dependencies in one pass:

```bash
npm install
```

## Common Scripts

The root `package.json` exposes convenience commands that fan out to each workspace:

- `npm run dev` – Start all available dev servers (Next.js, Express, Expo, Electron)
- `npm run build` – Type-check and build every package
- `npm run lint` – Run linting across workspaces
- `npm run test` – Execute workspace tests (Vitest for the API at present)

Each workspace also publishes its own script set. Examples:

```bash
# API tests
npm run test --workspace @soundscape/api

# Next.js development server
npm run dev --workspace @soundscape/web

# Expo mobile app
npm run start --workspace @soundscape/mobile

# Electron desktop shell (after building web app)
npm run dev --workspace @soundscape/desktop
```

## Developing Locally

1. Configure environment variables for every workspace (see individual READMEs for required keys). The API expects `DATABASE_URL`, JWT secrets, and optional SMTP settings. The clients use `NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`, or `SOUNDSCAPE_*` variables depending on target.
2. Push the Prisma schema to your development database and seed sounds if necessary:
   ```bash
   npm run db:push --workspace @soundscape/api
   npm run db:generate --workspace @soundscape/api
   ```
3. Start the API and the web client:
   ```bash
   npm run dev --workspace @soundscape/api
   npm run dev --workspace @soundscape/web
   ```
4. (Optional) Launch the mobile and desktop shells:
   ```bash
   npm run start --workspace @soundscape/mobile
   npm run dev --workspace @soundscape/desktop
   ```

## Testing

The API uses Vitest with Supertest and Prisma mocked out for fast endpoint verification:

```bash
npm run test --workspace @soundscape/api
```

Additional workspaces currently rely on TypeScript checks and linting. Add Jest or Playwright tests as you expand UI behaviour.

## Sharing Mixes

- The web and mobile clients call `POST /api/mixes` with serialized layers and master volume.
- The API validates payloads against the shared audio library, persists the mix, and returns a stable identifier.
- Clients build shareable URLs with `buildAppUrl` from the config package.

## License

MIT
