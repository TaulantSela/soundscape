# @soundscape/api

TypeScript Express API that powers authentication, mix persistence, and preset management for the Soundscape Mixer clients.

## Environment

Create a `.env` file inside `apps/api` with at least the following keys:

```
DATABASE_URL=postgres://...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
PORT=4000
FRONTEND_URL=http://localhost:3000
```

Optional values:

- `EMAIL_FROM`, `SMTP_URL` for password reset delivery
- `NODE_ENV` to toggle logging verbosity

## Commands

```bash
# Start the API with hot reload
npm run dev --workspace @soundscape/api

# Generate Prisma client after schema updates
npm run db:generate --workspace @soundscape/api

# Apply schema changes to your database
npm run db:push --workspace @soundscape/api

# Run automated tests (Vitest + Supertest)
npm run test --workspace @soundscape/api
```

## Routes

- `GET /api/health` – readiness probe
- `POST /api/mixes` – create a shareable mix
- `GET /api/mixes/:id` – fetch a previously shared mix
- Additional auth, sound, and preset routes are scaffolded for future development

The mix routes validate input using the shared audio library to ensure sound identifiers and volumes remain consistent across platforms.
