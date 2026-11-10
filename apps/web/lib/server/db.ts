import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let client: NeonQueryFunction<false, false> | undefined;

/** Neon's HTTP driver: one round trip per query, no connection to keep open. */
export function getSql() {
  if (!client) {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) {
      throw new Error('DATABASE_URL is not set.');
    }
    client = neon(url);
  }
  return client;
}
