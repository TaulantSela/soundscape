'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { AuthCard, FormMessage, GoogleButton, TextField, useAppSignIn } from '@/components/auth/auth-ui';
import { authClient } from '@/lib/auth/client';

const EXPIRED = 'This sign-in link has expired. Go back to the Soundscape app and sign in again.';

function hasStatus(error: unknown, status: number) {
  return typeof error === 'object' && error !== null && (error as { status?: unknown }).status === status;
}

function LoginForm() {
  const router = useRouter();
  const passwordWasReset = useSearchParams().get('reset') === '1';
  const { isAppSignIn, query } = useAppSignIn();
  // An app sign-in first checks for an existing session, which skips the form.
  const [checking, setChecking] = useState(isAppSignIn);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!isAppSignIn) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data: session } = await authClient.getSession();
        if (!session) {
          if (!cancelled) setChecking(false);
          return;
        }
        // Navigates on to the consent page, or straight back to the app.
        const { error: continueError } = await authClient.oauth2.continue({ selected: true });
        if (continueError && !cancelled) {
          setError(continueError.status === 400 ? EXPIRED : (continueError.message ?? EXPIRED));
          setChecking(false);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(hasStatus(caught, 400) ? EXPIRED : "Couldn't continue signing in. Please try again.");
          setChecking(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAppSignIn]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { data, error: signInError } = await authClient.signIn.email({
      email: String(form.get('email') ?? '').trim(),
      password: String(form.get('password') ?? '')
    });
    if (signInError) {
      setPending(false);
      setError(signInError.message ?? "Couldn't sign in. Please try again.");
      return;
    }
    // In an app sign-in the auth client is already on its way to the next step.
    if (data && 'redirect' in data && data.redirect) {
      return;
    }
    router.push('/');
    router.refresh();
  }

  if (checking) {
    return <p className="mt-8 text-sm text-textMuted">Checking your sign-in…</p>;
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      {passwordWasReset ? <FormMessage tone="info">Password updated. Sign in with your new password.</FormMessage> : null}
      <GoogleButton
        label="Continue with Google"
        onError={setError}
        returnTo={isAppSignIn ? `/auth/login?${query}` : '/'}
      />
      <TextField label="Email" type="email" name="email" autoComplete="email" placeholder="you@example.com" required />
      <TextField label="Password" type="password" name="password" autoComplete="current-password" placeholder="••••••••" required />
      {error ? <FormMessage>{error}</FormMessage> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
      {isAppSignIn ? (
        <p className="text-sm text-textMuted">
          Need an account?{' '}
          <Link href={`/auth/register?${query}` as Route} className="text-accent hover:text-accentMuted">
            Create one
          </Link>
        </p>
      ) : null}
    </form>
  );
}

function LoginFooter() {
  const { isAppSignIn } = useAppSignIn();
  // An app sign-in keeps its own link to registering (with its query).
  if (isAppSignIn) {
    return null;
  }
  return (
    <>
      <p>
        <Link href="/auth/forgot-password" className="text-accent hover:text-accentMuted">
          Forgot password?
        </Link>
      </p>
      <p>
        Need an account?{' '}
        <Link href="/auth/register" className="text-accent hover:text-accentMuted">
          Create one
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthCard
      title="Sign in"
      description="Upload your own sounds and mix them with the built-in ones."
      footer={
        <Suspense>
          <LoginFooter />
        </Suspense>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
