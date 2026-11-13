import { useCallback, useEffect, useRef, useState } from 'react';

import { forgetAllUserSoundFiles, type GetAccessToken } from './api';
import { SignInError, freshSession, loadSession, signIn, signOut, type Session } from './auth';

export type AccountStatus = 'loading' | 'signed-out' | 'signed-in';

export class SignedOutError extends Error {
  constructor() {
    super('Sign in again to use your sounds.');
  }
}

/** The account on this device: restores it, signs in and out, and hands out fresh access tokens. */
export function useAccount() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AccountStatus>('loading');
  const sessionRef = useRef<Session | null>(null);

  const apply = useCallback((next: Session | null) => {
    sessionRef.current = next;
    setSession(next);
    setStatus(next ? 'signed-in' : 'signed-out');
  }, []);

  useEffect(() => {
    loadSession()
      .then(apply)
      .catch(() => apply(null));
  }, [apply]);

  const getAccessToken: GetAccessToken = useCallback(
    async (force = false) => {
      const current = sessionRef.current;
      if (!current) {
        throw new SignedOutError();
      }
      const next = await freshSession(current, force);
      if (!next) {
        forgetAllUserSoundFiles();
        apply(null);
        throw new SignedOutError();
      }
      if (next !== current) {
        apply(next);
      }
      return next.accessToken;
    },
    [apply]
  );

  /** Resolves `false` if the user backed out; throws a `SignInError` if it failed. */
  const startSignIn = useCallback(async () => {
    const next = await signIn().catch((error: unknown) => {
      throw error instanceof SignInError
        ? error
        : new SignInError("Couldn't reach the sign-in page. Check your connection.");
    });
    if (next) {
      apply(next);
    }
    return Boolean(next);
  }, [apply]);

  const startSignOut = useCallback(async () => {
    const current = sessionRef.current;
    forgetAllUserSoundFiles();
    apply(null);
    await signOut(current);
  }, [apply]);

  return {
    status,
    email: session?.email ?? '',
    getAccessToken,
    signIn: startSignIn,
    signOut: startSignOut,
  };
}
