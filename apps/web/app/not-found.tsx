import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-slate-100">Nothing to play here</h1>
      <p className="mt-2 text-sm text-textMuted">
        This page or shared mix doesn&apos;t exist. The link may be incomplete.
      </p>
      <p className="mt-6">
        <Link href="/">Open the mixer</Link>
      </p>
    </main>
  );
}
