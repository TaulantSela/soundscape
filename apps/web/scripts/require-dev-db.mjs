// Runs before `npm run db:migrate`: it exits with an error unless the database is marked as a
// disposable dev database. Production is never marked, so if apps/web/.env.local ever points at
// it, the command stops instead of migrating production from a laptop. Production gets its
// migrations from its own build (scripts/migrate-on-production-build.mjs), which doesn't go
// through this check.
//
// The mark is a comment on the database itself, so it holds whichever connection string leads
// there. To mark a NEW dev database (never production), run this once against it, e.g. in
// Neon's SQL editor:
//   COMMENT ON DATABASE neondb IS 'soundscape:disposable';
import { Pool } from '@neondatabase/serverless';

const MARK = 'soundscape:disposable';

const urls = [...new Set([process.env.DATABASE_URL_UNPOOLED, process.env.DATABASE_URL].filter(Boolean))];
if (urls.length === 0) {
  console.error('DATABASE_URL is not set. Run `vercel env pull apps/web/.env.local` first.');
  process.exit(1);
}

const checked = [];
for (const url of urls) {
  const pool = new Pool({ connectionString: url });
  try {
    const { rows } = await pool.query(
      "select datname as name, shobj_description(oid, 'pg_database') as mark from pg_database where datname = current_database()"
    );
    const where = `${new URL(url).hostname.split('.')[0]}/${rows[0]?.name ?? '?'}`;
    if (rows[0]?.mark !== MARK) {
      console.error(
        `Refusing to touch ${where}: it isn't marked as a disposable dev database, and production never is.\n` +
          'apps/web/.env.local should point at the dev database: run `vercel env pull apps/web/.env.local` (see the README).'
      );
      process.exitCode = 1;
      break;
    }
    checked.push(where);
  } finally {
    await pool.end();
  }
}
if (!process.exitCode) console.log(`Dev database: ${checked.join(', ')}`);
