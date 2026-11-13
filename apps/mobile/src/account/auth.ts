import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

import { ACCOUNT } from './config';

const STORE_KEY = 'soundscape.account';
/** Refresh a little before the access token actually expires. */
const EXPIRY_MARGIN_MS = 60_000;

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  email: string;
}

export class SignInError extends Error {}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

// React Native's URLSearchParams can't read or build reliably; these are tiny.
function toQuery(params: Record<string, string>) {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function parseQuery(url: string) {
  const query = url.split('?')[1]?.split('#')[0] ?? '';
  const params: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const [key, value = ''] = pair.split('=');
    params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
  }
  return params;
}

function base64Url(base64: string) {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(bytes: number) {
  const random = Crypto.getRandomBytes(bytes);
  let binary = '';
  random.forEach((byte) => (binary += String.fromCharCode(byte)));
  return base64Url(btoa(binary));
}

async function requestTokens(
  params: Record<string, string>
): Promise<TokenResponse & { status: number }> {
  const response = await fetch(`${ACCOUNT.issuer}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: toQuery({ ...params, client_id: ACCOUNT.clientId }),
  });
  const body = (await response.json().catch(() => ({}))) as TokenResponse;
  return { ...body, status: response.status };
}

async function fetchEmail(accessToken: string) {
  const response = await fetch(`${ACCOUNT.issuer}/oauth2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json().catch(() => null)) as { email?: unknown } | null;
  return typeof body?.email === 'string' ? body.email : '';
}

function toSession(tokens: TokenResponse, email: string): Session {
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new SignInError(tokens.error_description ?? "Couldn't sign in. Please try again.");
  }
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    email,
  };
}

async function save(session: Session | null) {
  if (session) {
    await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(session));
  } else {
    await SecureStore.deleteItemAsync(STORE_KEY);
  }
}

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/**
 * Sign in on the website in a sign-in browser (authorization code with PKCE).
 * Returns `null` if the user closed it. The session is ephemeral: it shares
 * no cookies with Safari, so iOS doesn't first ask to let the app use the
 * website, and the app is the only place this sign-in lives.
 */
export async function signIn(): Promise<Session | null> {
  const verifier = randomString(32);
  const state = randomString(16);
  const challenge = base64Url(
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
      encoding: Crypto.CryptoEncoding.BASE64,
    })
  );
  const start = `${ACCOUNT.webUrl}/auth/app-authorize?${toQuery({
    response_type: 'code',
    client_id: ACCOUNT.clientId,
    redirect_uri: ACCOUNT.redirectUri,
    scope: ACCOUNT.scope,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    resource: ACCOUNT.resource,
  })}`;

  const result = await WebBrowser.openAuthSessionAsync(start, ACCOUNT.appCallback, {
    preferEphemeralSession: true,
  });
  if (result.type !== 'success') {
    return null;
  }
  const params = parseQuery(result.url);
  if (params.state !== state) {
    throw new SignInError("Couldn't sign in. Please try again.");
  }
  if (params.error || !params.code) {
    // "Cancel" on the consent page.
    if (params.error === 'access_denied') return null;
    throw new SignInError(params.error_description || "Couldn't sign in. Please try again.");
  }

  const tokens = await requestTokens({
    grant_type: 'authorization_code',
    code: params.code,
    code_verifier: verifier,
    redirect_uri: ACCOUNT.redirectUri,
    resource: ACCOUNT.resource,
  });
  const session = toSession(tokens, '');
  session.email = await fetchEmail(session.accessToken).catch(() => '');
  await save(session);
  return session;
}

let refreshing: Promise<Session | null> | null = null;

/**
 * A session whose access token is good for at least another minute,
 * refreshing it if needed. `null` means signed out: the refresh token
 * expired or was revoked. Concurrent callers share one refresh, because each
 * refresh token works only once.
 */
export function freshSession(session: Session, force = false): Promise<Session | null> {
  if (!force && session.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
    return Promise.resolve(session);
  }
  refreshing ??= (async () => {
    try {
      const tokens = await requestTokens({
        grant_type: 'refresh_token',
        refresh_token: session.refreshToken,
      });
      if (tokens.status >= 400 && tokens.status < 500) {
        await save(null);
        return null;
      }
      const next = toSession(tokens, session.email);
      await save(next);
      return next;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Forget the session on this device and revoke its refresh token. */
export async function signOut(session: Session | null) {
  await save(null);
  if (session) {
    await fetch(`${ACCOUNT.issuer}/oauth2/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: toQuery({
        token: session.refreshToken,
        token_type_hint: 'refresh_token',
        client_id: ACCOUNT.clientId,
      }),
    }).catch(() => undefined);
  }
}
