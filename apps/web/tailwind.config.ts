import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f172a',
        foreground: '#0b1220',
        accent: '#38bdf8',
        accentMuted: '#0ea5e9',
        surface: '#111c31',
        surfaceRaised: '#15243d',
        textMuted: '#94a3b8'
      },
      boxShadow: {
        glow: '0 0 35px rgba(56, 189, 248, 0.25)'
      },
      transitionTimingFunction: {
        'ease-glide': 'cubic-bezier(0.25, 0.1, 0.25, 1)'
      }
    }
  },
  plugins: []
};

export default config;
