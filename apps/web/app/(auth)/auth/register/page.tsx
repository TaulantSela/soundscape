'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { AuthCard, FormMessage, GoogleButton, TextField } from '@/components/auth/auth-ui';
import { authClient } from '@/lib/auth/client';

const MIN_PASSWORD_LENGTH = 8;

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const name = String(form.get('name') ?? '').trim() || email.split('@')[0];
    setPending(true);
    setError(null);
    const { error: signUpError } = await authClient.signUp.email({
      name,
      email,
      password: String(form.get('password') ?? '')
    });
    if (signUpError) {
      setPending(false);
      setError(signUpError.message ?? "Couldn't create your account. Please try again.");
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <AuthCard
      title="Create account"
      description="Upload your own sounds and mix them with the built-in ones. Only you can hear them."
      footer={
        <p>
          Already have an account?{' '}
          <Link href="/auth/login" className="text-accent hover:text-accentMuted">
            Sign in
          </Link>
        </p>
      }
    >
      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <GoogleButton label="Sign up with Google" onError={setError} />
        <TextField label="Name" type="text" name="name" autoComplete="name" placeholder="Your name" maxLength={80} />
        <TextField label="Email" type="email" name="email" autoComplete="email" placeholder="you@example.com" required />
        <TextField
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
        {error ? <FormMessage>{error}</FormMessage> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthCard>
  );
}
