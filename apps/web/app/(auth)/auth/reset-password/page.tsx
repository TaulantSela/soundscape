'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { AuthCard, FormMessage, TextField } from '@/components/auth/auth-ui';
import { authClient } from '@/lib/auth/client';

const MIN_PASSWORD_LENGTH = 8;

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');
  const linkError = params.get('error');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!token || linkError) {
    return (
      <div className="mt-8 space-y-5">
        <FormMessage>This reset link is invalid or has expired.</FormMessage>
        <Link href="/auth/forgot-password" className="text-sm text-accent hover:text-accentMuted">
          Send a new link
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get('password') ?? '');
    if (newPassword !== String(form.get('confirm') ?? '')) {
      setError("The passwords don't match.");
      return;
    }
    setPending(true);
    setError(null);
    const { error: resetError } = await authClient.resetPassword({ newPassword, token: token ?? '' });
    if (resetError) {
      setPending(false);
      setError(resetError.message ?? "Couldn't update your password. Please try again.");
      return;
    }
    router.push('/auth/login?reset=1');
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <TextField
        label="New password"
        type="password"
        name="password"
        autoComplete="new-password"
        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        minLength={MIN_PASSWORD_LENGTH}
        required
      />
      <TextField
        label="Confirm password"
        type="password"
        name="confirm"
        autoComplete="new-password"
        placeholder="Repeat password"
        minLength={MIN_PASSWORD_LENGTH}
        required
      />
      {error ? <FormMessage>{error}</FormMessage> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Save new password'}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password" description="Pick a new password for your Soundscape account.">
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthCard>
  );
}
