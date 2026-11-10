import { createNeonAuth } from '@neon/auth/next/server';

type NeonAuth = ReturnType<typeof createNeonAuth>;

let instance: NeonAuth | undefined;

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set. Pull the project's environment with \`vercel env pull apps/web/.env.local\`.`);
  }
  return value;
}

/**
 * Managed Better Auth (Neon Auth). Created on first use so that building the
 * app never needs the auth secrets; a request without them fails loudly.
 */
export function getAuth(): NeonAuth {
  instance ??= createNeonAuth({
    baseUrl: requireEnv('NEON_AUTH_BASE_URL'),
    cookies: { secret: requireEnv('NEON_AUTH_COOKIE_SECRET') }
  });
  return instance;
}
