'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AuthCard, FormMessage } from '@/components/auth/auth-ui';
import { authClient } from '@/lib/auth/client';

const FAILED = "This request couldn't be completed. Go back to the Soundscape app and sign in again.";

/** What each requested scope lets the app do, in the user's terms. */
const SCOPE_TEXT: Record<string, string> = {
  email: 'See your email address',
  profile: 'See your name',
  offline_access: 'Stay signed in until you sign out of it'
};

interface Details {
  clientName: string;
  email: string;
}

function ConsentForm() {
  const params = useSearchParams();
  const clientId = params.get('client_id') ?? '';
  const scopes = (params.get('scope') ?? '').split(' ').filter((scope) => scope in SCOPE_TEXT);
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState<string | null>(clientId ? null : FAILED);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!clientId) {
      return;
    }
    let cancelled = false;
    Promise.all([authClient.getSession(), authClient.oauth2.publicClient({ query: { client_id: clientId } })])
      .then(([session, client]) => {
        if (cancelled) return;
        const email = session.data?.user.email;
        const clientName = client.data?.client_name;
        if (!email || !clientName) {
          setError(FAILED);
          return;
        }
        setDetails({ clientName, email });
      })
      .catch(() => {
        if (!cancelled) setError(FAILED);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  async function answer(accept: boolean) {
    setPending(true);
    // On success the auth client navigates back to the app itself.
    const { error: consentError } = await authClient.oauth2.consent({ accept }).catch(() => ({ error: true }));
    if (consentError) {
      setPending(false);
      setError(FAILED);
    }
  }

  if (error) {
    return (
      <div className="mt-8">
        <FormMessage>{error}</FormMessage>
      </div>
    );
  }
  if (!details) {
    return <p className="mt-8 text-sm text-textMuted">Loading…</p>;
  }

  return (
    <div className="mt-8 space-y-6">
      <p className="text-sm text-slate-100">
        <strong>{details.clientName}</strong> wants to use your account, <strong>{details.email}</strong>. It will be able
        to:
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-100">
        <li>Play, upload and delete your sounds</li>
        {scopes.map((scope) => (
          <li key={scope}>{SCOPE_TEXT[scope]}</li>
        ))}
      </ul>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" className="w-full" disabled={pending} onClick={() => void answer(true)}>
          {pending ? 'Opening the app…' : 'Allow'}
        </Button>
        <Button type="button" variant="ghost" className="w-full" disabled={pending} onClick={() => void answer(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default function ConsentPage() {
  return (
    <AuthCard title="Allow access?" description="An app is asking to use your Soundscape account.">
      <Suspense>
        <ConsentForm />
      </Suspense>
    </AuthCard>
  );
}
