'use client';

import { useEffect } from 'react';
import type { SoundDefinition } from '@soundscape/audio-library';
import { useMixerStore } from '@/store/mixer-store';

const TEXT_ENTRY = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
// Space already activates these natively; handling it too would double-toggle.
const SPACE_ACTIVATED = `${TEXT_ENTRY}, button, a[href], summary, [role="button"], [role="slider"], [role="switch"]`;

function matches(target: EventTarget | null, selector: string) {
  return target instanceof Element && (target.closest(selector) !== null || (target as HTMLElement).isContentEditable);
}

export function useMixerShortcuts(sounds: SoundDefinition[], unlock: () => void) {
  const toggleSound = useMixerStore((state) => state.toggleSound);
  const togglePlaying = useMixerStore((state) => state.togglePlaying);

  useEffect(() => {
    const keyIndexMap = sounds.slice(0, 9).map((sound) => sound.id);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.code === 'Space') {
        if (matches(event.target, SPACE_ACTIVATED)) {
          return;
        }
        event.preventDefault();
        unlock();
        togglePlaying();
        return;
      }

      // `code` is the physical key, so this works on AZERTY and other layouts
      // where the digit row doesn't produce digits without Shift.
      const digit = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
      if (digit && !matches(event.target, TEXT_ENTRY)) {
        const soundId = keyIndexMap[Number(digit[1]) - 1];
        if (soundId) {
          event.preventDefault();
          unlock();
          toggleSound(soundId);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sounds, togglePlaying, toggleSound, unlock]);
}
