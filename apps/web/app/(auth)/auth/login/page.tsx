import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-3xl border border-surfaceRaised bg-surface/80 p-8 backdrop-blur">
        <h1 className="text-2xl font-semibold text-slate-100">Sign in</h1>
        <p className="mt-1 text-sm text-textMuted">Access your presets across web, mobile, and desktop.</p>

        <form className="mt-8 space-y-5">
          <label className="flex flex-col gap-2 text-sm text-slate-100">
            Email
            <input
              type="email"
              name="email"
              placeholder="you@example.com"
              className="rounded-2xl border border-surfaceRaised bg-background/80 px-4 py-3 text-slate-100 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-100">
            Password
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              className="rounded-2xl border border-surfaceRaised bg-background/80 px-4 py-3 text-slate-100 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40"
              required
            />
          </label>
          <Button type="submit" className="w-full" disabled>
            Sign in (coming soon)
          </Button>
        </form>

        <div className="mt-6 text-sm text-textMuted">
          <p>
            <Link href="/auth/forgot-password" className="text-accent hover:text-accentMuted">
              Forgot password?
            </Link>
          </p>
          <p className="mt-2">
            Need an account?{' '}
            <Link href="/auth/register" className="text-accent hover:text-accentMuted">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
