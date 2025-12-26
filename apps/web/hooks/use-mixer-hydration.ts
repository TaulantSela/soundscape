'use client';

import { useEffect } from 'react';
import type { PresetDefinition, SoundDefinition } from '@soundscape/audio-library';
import { rehydrateMixerStore, useMixerStore } from '@/store/mixer-store';

export function useMixerHydration(sounds: SoundDefinition[], presets: PresetDefinition[]) {
  const initialize = useMixerStore((state) => state.initialize);
  const hydrated = useMixerStore((state) => state.hydrated);

  useEffect(() => {
    rehydrateMixerStore();
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    initialize(sounds, presets);
  }, [hydrated, initialize, sounds, presets]);
}
