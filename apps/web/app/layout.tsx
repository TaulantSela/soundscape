import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Providers from './providers';
import './globals.css';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Soundscape Mixer',
  description: 'Blend ambient layers for focus, sleep, and relaxation.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-background">
      <body className={`${inter.className} bg-background text-slate-50`}> 
        <Providers>
          <div className="min-h-screen bg-gradient-to-br from-background via-surface to-background">
            {children}
          </div>
        </Providers>
        <Toaster richColors position="bottom-center" theme="dark" />
      </body>
    </html>
  );
}
