'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { AuthCard, FormMessage, GoogleButton, TextField } from '@/components/auth/auth-ui';
import { authClient } from '@/lib/auth/client';

function LoginForm() {
  const router = useRouter();
  const passwordWasReset = useSearchParams().get('reset') === '1';
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.email({
      email: String(form.get('email') ?? '').trim(),
      password: String(form.get('password') ?? '')
    });
    if (signInError) {
      setPending(false);
      setError(signInError.message ?? "Couldn't sign in. Please try again.");
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      {passwordWasReset ? <FormMessage tone="info">Password updated. Sign in with your new password.</FormMessage> : null}
      <GoogleButton label="Continue with Google" onError={setError} />
      <TextField label="Email" type="email" name="email" autoComplete="email" placeholder="you@example.com" required />
      <TextField label="Password" type="password" name="password" autoComplete="current-password" placeholder="••••••••" required />
      {error ? <FormMessage>{error}</FormMessage> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthCard
      title="Sign in"
      description="Upload your own sounds and mix them with the built-in ones."
      footer={
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
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
