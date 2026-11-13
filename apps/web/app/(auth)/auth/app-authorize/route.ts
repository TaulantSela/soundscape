import { requireEnv } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

function invalid() {
  return new Response("This sign-in link isn't valid. Go back to the Soundscape app and try again.", {
    status: 400,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

/**
 * Where the native app starts signing in. Neon Auth's authorize endpoint
 * answers with JSON (`{ redirect, url }`) rather than an HTTP redirect, so a
 * browser opened on it would just show that JSON. This asks it on the app's
 * behalf and sends the browser on to the login page it names.
 */
export async function GET(request: Request) {
  const { search } = new URL(request.url);
  if (!search) {
    return invalid();
  }
  const issuer = requireEnv('NEON_AUTH_BASE_URL').replace(/\/+$/, '');
  const response = await fetch(`${issuer}/oauth2/authorize${search}`, {
    cache: 'no-store',
    headers: { accept: 'application/json' }
  }).catch(() => null);
  const body = (await response?.json().catch(() => null)) as { url?: unknown } | null;
  if (!response?.ok || typeof body?.url !== 'string' || !body.url.startsWith('https://')) {
    return invalid();
  }
  return new Response(null, { status: 302, headers: { Location: body.url, 'Cache-Control': 'no-store' } });
}
