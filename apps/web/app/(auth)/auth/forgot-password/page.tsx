'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { AuthCard, FormMessage, TextField } from '@/components/auth/auth-ui';
import { authClient } from '@/lib/auth/client';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error: resetError } = await authClient.requestPasswordReset({
      email: String(form.get('email') ?? '').trim(),
      redirectTo: `${window.location.origin}/auth/reset-password`
    });
    setPending(false);
    if (resetError) {
      setError(resetError.message ?? "Couldn't send the email. Please try again.");
      return;
    }
    setSent(true);
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we'll send you a link to choose a new password."
      footer={
        <p>
          Remembered it?{' '}
          <Link href="/auth/login" className="text-accent hover:text-accentMuted">
            Back to sign in
          </Link>
        </p>
      }
    >
      {sent ? (
        <div className="mt-8">
          {/* The same message either way, so the form can't reveal who has an account. */}
          <FormMessage tone="info">If an account exists for that email, a reset link is on its way.</FormMessage>
        </div>
      ) : (
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <TextField label="Email" type="email" name="email" autoComplete="email" placeholder="you@example.com" required />
          {error ? <FormMessage>{error}</FormMessage> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
