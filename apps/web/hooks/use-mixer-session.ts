'use client';

import { useEffect } from 'react';
import type { PresetDefinition, SharedMix, SoundDefinition } from '@soundscape/audio-library';
import { useMixerStore } from '@/store/mixer-store';

/** Load the visitor's saved mix, or a shared mix without touching the saved one. */
export function useMixerSession(sounds: SoundDefinition[], presets: PresetDefinition[], sharedMix?: SharedMix) {
  const startPersonalSession = useMixerStore((state) => state.startPersonalSession);
  const startSharedSession = useMixerStore((state) => state.startSharedSession);

  useEffect(() => {
    if (sharedMix) {
      startSharedSession(sounds, presets, sharedMix);
    } else {
      void startPersonalSession(sounds, presets);
    }
  }, [sounds, presets, sharedMix, startPersonalSession, startSharedSession]);
}
