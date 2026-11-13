'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useSyncExternalStore, type InputHTMLAttributes, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth/client';

export function AuthCard({
  title,
  description,
  children,
  footer
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-3xl border border-surfaceRaised bg-surface/80 p-8 backdrop-blur">
        <Link href="/" className="text-sm text-textMuted hover:text-slate-100">
          ← Back to the mixer
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-slate-100">{title}</h1>
        <p className="mt-1 text-sm text-textMuted">{description}</p>
        {children}
        {footer ? <div className="mt-6 space-y-2 text-sm text-textMuted">{footer}</div> : null}
      </div>
    </main>
  );
}

export function TextField({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-2 text-sm text-slate-100">
      {label}
      <input
        {...props}
        className="rounded-2xl border border-surfaceRaised bg-background/80 px-4 py-3 text-slate-100 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40"
      />
    </label>
  );
}

export function FormMessage({ tone = 'error', children }: { tone?: 'error' | 'info'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={
        tone === 'error'
          ? 'rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200'
          : 'rounded-2xl bg-accent/10 px-4 py-3 text-sm text-slate-100'
      }
    >
      {children}
    </p>
  );
}

const noSubscription = () => () => undefined;

/**
 * Google sign-in. Hidden inside the desktop app: Google refuses to sign in
 * from embedded browsers such as Electron's window.
 */
export function GoogleButton({
  label,
  onError,
  returnTo = '/'
}: {
  label: string;
  onError: (message: string) => void;
  /** Path (with query) on this site to come back to after Google. */
  returnTo?: string;
}) {
  // Hidden while rendering on the server, then shown unless in the desktop app.
  const isDesktop = useSyncExternalStore(
    noSubscription,
    () => Boolean(window.soundscapeDesktop),
    () => true
  );
  const [pending, setPending] = useState(false);

  if (isDesktop) {
    return null;
  }

  async function handleClick() {
    setPending(true);
    const { error } = await authClient.signIn.social({ provider: 'google', callbackURL: `${window.location.origin}${returnTo}` });
    // On success the browser is already on its way to Google.
    if (error) {
      setPending(false);
      onError(error.message ?? "Couldn't start Google sign-in. Please try again.");
    }
  }

  return (
    <>
      <Button type="button" variant="secondary" className="w-full" disabled={pending} onClick={() => void handleClick()}>
        {pending ? 'Opening Google…' : label}
      </Button>
      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-textMuted" aria-hidden>
        <span className="h-px flex-1 bg-surfaceRaised" />
        or
        <span className="h-px flex-1 bg-surfaceRaised" />
      </div>
    </>
  );
}

/**
 * A sign-in for the native app: Neon Auth's OAuth provider sends the browser
 * here with a signed query (`client_id`, `sig`, …). The auth client attaches
 * that query to sign-in requests, which resume the app's authorization, so
 * links between the auth pages must carry it along unchanged.
 */
export function useAppSignIn() {
  const params = useSearchParams();
  const isAppSignIn = params.has('client_id') && params.has('sig');
  return { isAppSignIn, query: isAppSignIn ? params.toString() : '' };
}
