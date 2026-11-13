export const dynamic = 'force-dynamic';

/** The app's own address; only the app opens it. */
const APP_CALLBACK = 'soundscape://auth/callback';
const FORWARDED = ['code', 'state', 'iss', 'error', 'error_description'];

/**
 * Hands an app sign-in back to the app. Neon Auth only redirects OAuth
 * clients to https addresses, so the authorization code lands here and is
 * passed on to the app's scheme, which the app's sign-in browser is waiting
 * for. Another app claiming the scheme couldn't use the code: exchanging it
 * needs the PKCE verifier that only the app that started the sign-in holds.
 */
export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const forwarded = new URLSearchParams();
  for (const key of FORWARDED) {
    const value = searchParams.get(key);
    if (value !== null) {
      forwarded.set(key, value);
    }
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${APP_CALLBACK}?${forwarded}`,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer'
    }
  });
}
