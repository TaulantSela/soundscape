import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

function resolveSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured;
  }
  // Set by Vercel on every deployment.
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return production ? `https://${production}` : 'http://localhost:3000';
}

export const metadata: Metadata = {
  title: 'Soundscape Mixer',
  description: 'Blend ambient layers for focus, sleep, and relaxation.',
  metadataBase: new URL(resolveSiteUrl())
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-background">
      <body className={`${inter.className} bg-background text-slate-50`}>
        <div className="min-h-screen bg-gradient-to-br from-background via-surface to-background">{children}</div>
        <Toaster richColors position="bottom-center" theme="dark" />
      </body>
    </html>
  );
}
