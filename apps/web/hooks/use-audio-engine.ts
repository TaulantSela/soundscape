'use client';

import { useEffect, useState } from 'react';
import type { SoundDefinition } from '@soundscape/audio-library';
import { MixerAudioEngine } from '@/lib/mixer-audio-engine';
import { useMixerStore } from '@/store/mixer-store';

/**
 * Keeps the audio engine in step with the mixer store. The returned engine's
 * `unlock()` must be called synchronously from click/key handlers that start
 * or change playback (Safari only starts audio from a user gesture).
 */
export function useAudioEngine(sounds: SoundDefinition[]) {
  // The constructor touches no browser APIs, so this is safe during SSR.
  const [engine] = useState(() => new MixerAudioEngine(sounds));
  const mix = useMixerStore((state) => state.mix);

  useEffect(() => {
    engine.setState(mix);
  }, [engine, mix]);

  useEffect(() => () => engine.dispose(), [engine]);

  return engine;
}
