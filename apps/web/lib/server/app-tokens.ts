import { createRemoteJWKSet, jwtVerify } from 'jose';
import { isUuid } from '@soundscape/audio-library';
import { requireEnv } from '@/lib/auth/server';
import type { CurrentUser } from './current-user';

/**
 * The native app signs in through Neon Auth's OAuth provider and calls this
 * API with its access tokens. They are JWTs whose audience is this
 * identifier, which is registered as a protected resource on the provider.
 * It names the API; nothing is served from it.
 */
export const APP_API_RESOURCE = 'https://soundscape-web-one.vercel.app/api';

let keys: ReturnType<typeof createRemoteJWKSet> | undefined;

/**
 * The user an app access token was issued to, or `null` if it isn't valid
 * here. Every branch of the Neon project shares signing keys, so the issuer
 * (this branch's Auth URL) and the audience are checked, not just the
 * signature.
 */
export async function verifyAppToken(token: string): Promise<CurrentUser | null> {
  const issuer = requireEnv('NEON_AUTH_BASE_URL').replace(/\/+$/, '');
  keys ??= createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer,
      audience: APP_API_RESOURCE,
      algorithms: ['EdDSA']
    });
    return typeof payload.sub === 'string' && isUuid(payload.sub) ? { id: payload.sub } : null;
  } catch {
    return null;
  }
}
