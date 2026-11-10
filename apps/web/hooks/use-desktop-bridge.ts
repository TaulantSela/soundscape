'use client';

import { useEffect } from 'react';

/** Bridge exposed by the Electron preload script (apps/desktop/src/preload.ts). */
export interface SoundscapeDesktopBridge {
  requestTogglePlay(): void;
  onTogglePlay(callback: () => void): () => void;
}

declare global {
  interface Window {
    soundscapeDesktop?: SoundscapeDesktopBridge;
  }
}

/** Run `onToggle` when the desktop tray's Play/Pause item is clicked. */
export function useDesktopBridge(onToggle: () => void) {
  useEffect(() => window.soundscapeDesktop?.onTogglePlay(onToggle), [onToggle]);
}
