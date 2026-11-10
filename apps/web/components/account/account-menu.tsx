'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth/client';

export function AccountMenu() {
  const { data: session, isPending } = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);

  if (isPending) {
    // Reserve the space so the header doesn't jump when the session arrives.
    return <div className="h-8" aria-hidden />;
  }

  if (!session) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <Link href="/auth/login" className="text-accent hover:text-accentMuted">
          Sign in
        </Link>
        <Link
          href="/auth/register"
          className="rounded-full bg-surfaceRaised px-3 py-1.5 text-slate-100 transition-colors hover:bg-surface"
        >
          Create account
        </Link>
      </div>
    );
  }

  async function handleSignOut() {
    setSigningOut(true);
    const { error } = await authClient.signOut();
    setSigningOut(false);
    if (error) {
      toast.error(error.message ?? "Couldn't sign out. Please try again.");
      return;
    }
    toast.success('Signed out.');
  }

  return (
    <div className="flex min-w-0 items-center gap-3 text-sm">
      <span className="truncate text-textMuted" title={session.user.email}>
        {session.user.email}
      </span>
      <Button type="button" variant="secondary" size="sm" disabled={signingOut} onClick={() => void handleSignOut()}>
        Sign out
      </Button>
    </div>
  );
}
