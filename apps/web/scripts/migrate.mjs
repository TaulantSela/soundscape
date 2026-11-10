// Applies db/migrations/*.sql in order, once each, inside a transaction.
// Usage: npm run db:migrate --workspace @soundscape/web  (reads DATABASE_URL)
import { readdir, readFile } from 'node:fs/promises';
import { Pool } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Run `vercel env pull apps/web/.env.local` first.');
  process.exit(1);
}

const dir = new URL('../db/migrations/', import.meta.url);
const files = (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort();
const pool = new Pool({ connectionString: url });

try {
  await pool.query(
    'create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())'
  );
  const { rows } = await pool.query('select name from schema_migrations');
  const applied = new Set(rows.map((row) => row.name));

  for (const name of files) {
    if (applied.has(name)) {
      continue;
    }
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(await readFile(new URL(name, dir), 'utf8'));
      await client.query('insert into schema_migrations (name) values ($1)', [name]);
      await client.query('commit');
      console.log(`applied ${name}`);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }
  console.log('migrations up to date');
} finally {
  await pool.end();
}
