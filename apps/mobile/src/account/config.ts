import { PRODUCTION_APP_URL } from '@soundscape/config';

/**
 * Signing in uses Neon Auth's OAuth provider; see "Signing in from the native
 * app" in apps/web/README.md. These identify that setup and are not secrets:
 * the app is a public client and proves itself with PKCE.
 */
export const ACCOUNT = {
  /** The website: hosts the sign-in pages and the sounds API. */
  webUrl: PRODUCTION_APP_URL,
  /** Neon Auth's URL for the production branch; tokens name it as issuer. */
  issuer: 'https://ep-lingering-band-baevo9xv.neonauth.c-8.eu-central-1.aws.neon.tech/neondb/auth',
  clientId: 'FzpipYmjYIcdIDBZcPeUQLpbNQLMQmEF',
  /** Where the website hands the sign-in back to the app. */
  redirectUri: `${PRODUCTION_APP_URL}/auth/app-callback`,
  appCallback: 'soundscape://auth/callback',
  /** The API the access tokens are for (their audience). */
  resource: `${PRODUCTION_APP_URL}/api`,
  scope: 'openid email offline_access',
} as const;
