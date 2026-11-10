# @soundscape/api

TypeScript Express API for accounts, saved presets and stored mixes. **No client depends on it today:** share links carry the whole mix in the URL, so the web, mobile and desktop apps work without it. It is kept for features that need a server (accounts, syncing presets across devices).

## Environment

Create `apps/api/.env`:

```
DATABASE_URL=postgres://...
JWT_ACCESS_SECRET=...          # at least 32 characters
JWT_REFRESH_SECRET=...         # at least 32 characters
PORT=4000
FRONTEND_URL=https://soundscape-web-one.vercel.app
```

Optional:

- `FRONTEND_URL` accepts a comma-separated list of browser origins allowed by CORS. Outside production, `localhost` origins are always allowed.
- `TRUST_PROXY` is the number of reverse proxies in front of the API (for example `1` behind a load balancer). Set it only when there is a proxy; otherwise clients could spoof their IP and dodge the rate limits.
- `EMAIL_FROM`, `SMTP_URL` for password reset delivery (not implemented yet).

## Commands

```bash
npm run dev --workspace @soundscape/api            # start with hot reload
npm run test --workspace @soundscape/api           # Vitest + Supertest
npm run db:migrate --workspace @soundscape/api     # apply committed migrations (production)
npm run db:migrate:dev --workspace @soundscape/api # create a migration after editing the schema
npm run db:studio --workspace @soundscape/api
```

`dev`, `build`, `test` and `typecheck` run `prisma generate` first, so a fresh checkout works without extra steps.

## Routes

- `GET /api/health` – readiness probe
- `POST /api/mixes` – store a mix (rate limited to 20 requests per minute per client)
- `GET /api/mixes/:id` – fetch a stored mix
- Auth, sound and preset routes are stubs that return `501 Not Implemented`

Mix payloads are validated against the shared audio library: unknown or duplicate sounds are rejected. Server errors return a generic message; details are only logged.
