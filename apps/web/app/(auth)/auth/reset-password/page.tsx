import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-3xl border border-surfaceRaised bg-surface/80 p-8 backdrop-blur">
        <h1 className="text-2xl font-semibold text-slate-100">Choose a new password</h1>
        <p className="mt-1 text-sm text-textMuted">Paste the reset code from your email and pick a new password.</p>

        <form className="mt-8 space-y-5">
          <label className="flex flex-col gap-2 text-sm text-slate-100">
            Reset token
            <input
              type="text"
              name="token"
              placeholder="Reset code"
              className="rounded-2xl border border-surfaceRaised bg-background/80 px-4 py-3 text-slate-100 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-100">
            New password
            <input
              type="password"
              name="password"
              placeholder="At least 8 characters"
              className="rounded-2xl border border-surfaceRaised bg-background/80 px-4 py-3 text-slate-100 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40"
              required
              minLength={8}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-100">
            Confirm password
            <input
              type="password"
              name="confirmPassword"
              placeholder="Repeat password"
              className="rounded-2xl border border-surfaceRaised bg-background/80 px-4 py-3 text-slate-100 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40"
              required
              minLength={8}
            />
          </label>
          <Button type="submit" className="w-full" disabled>
            Update password (coming soon)
          </Button>
        </form>

        <p className="mt-6 text-sm text-textMuted">
          Return to{' '}
          <Link href="/auth/login" className="text-accent hover:text-accentMuted">
            sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
