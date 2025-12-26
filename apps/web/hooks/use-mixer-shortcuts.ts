'use client';

import { useEffect } from 'react';
import type { SoundDefinition } from '@soundscape/audio-library';
import { useMixerStore } from '@/store/mixer-store';

export function useMixerShortcuts(sounds: SoundDefinition[]) {
  const toggleSound = useMixerStore((state) => state.toggleSound);
  const togglePlaying = useMixerStore((state) => state.togglePlaying);

  useEffect(() => {
    const keyIndexMap = sounds.slice(0, 9).map((sound) => sound.id);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        togglePlaying();
        return;
      }

      if (/^Digit[1-9]$/.test(event.code)) {
        const index = Number.parseInt(event.key, 10) - 1;
        const soundId = keyIndexMap[index];
        if (soundId) {
          event.preventDefault();
          toggleSound(soundId);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sounds, togglePlaying, toggleSound]);
}
