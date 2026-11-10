import { NextResponse } from 'next/server';
import { getCurrentUser, type CurrentUser } from './current-user';
import { UserSoundError } from './user-sounds';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function jsonError(message: string, status: number) {
  return json({ error: message }, status);
}

/**
 * State-changing requests from browsers must come from our own pages. The
 * session cookie is SameSite=Lax already; this also refuses cross-site
 * requests that would not send it. Native apps send no Origin header.
 */
function isAllowedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

/** Run an API handler for the signed-in user, mapping known failures to JSON errors. */
export async function withUser(request: Request, handler: (user: CurrentUser) => Promise<Response>) {
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD' && !isAllowedOrigin(request)) {
      return jsonError('Forbidden.', 403);
    }
    const user = await getCurrentUser();
    if (!user) {
      return jsonError('Sign in to manage your sounds.', 401);
    }
    return await handler(user);
  } catch (error) {
    if (error instanceof UserSoundError) {
      return jsonError(error.message, error.status);
    }
    console.error(error);
    return jsonError('Something went wrong. Please try again.', 500);
  }
}

/** Parse a JSON body, answering 400 instead of throwing on bad input. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new UserSoundError('Expected a JSON body.', 400);
  }
}
