// Runs in the Vercel build (apps/web/vercel.json), right before `next build`. On production
// builds it applies pending migrations (scripts/migrate.mjs: db/migrations/*.sql in order, once
// each, in a transaction), so a merged PR's migrations reach production with its code. Everywhere
// else it does nothing.
//
// If a migration fails, the build fails and the current production deployment stays live.
// Previews share the production database, and the previous version keeps serving while the build
// runs, so keep migrations backward-compatible: add tables and columns first, and remove what the
// old code still reads in a later release.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (process.env.VERCEL_ENV === 'production') {
  console.log('Production build: applying pending migrations (scripts/migrate.mjs).');
  execFileSync(process.execPath, [fileURLToPath(new URL('./migrate.mjs', import.meta.url))], {
    stdio: 'inherit',
  });
} else {
  console.log(`Not a production build (VERCEL_ENV=${process.env.VERCEL_ENV ?? 'unset'}): no migrations.`);
}
