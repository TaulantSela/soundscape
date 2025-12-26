'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { SoundDefinition } from '@soundscape/audio-library';
import { DEFAULT_FADE_MS } from '@soundscape/audio-library';
import { useMixerStore } from '@/store/mixer-store';
import { getSoundUrl } from '@/lib/audio';

interface EngineSound {
  id: string;
  element: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  gainNode: GainNode;
  stopTimer?: ReturnType<typeof setTimeout>;
}

class MixerAudioEngine {
  private context: AudioContext;
  private masterGain: GainNode;
  private sounds = new Map<string, EngineSound>();
  private isPlaying = false;

  constructor(private readonly definitions: SoundDefinition[]) {
    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 1;
    this.masterGain.connect(this.context.destination);

    this.prepareSounds();
  }

  private prepareSounds() {
    for (const sound of this.definitions) {
      const element = new Audio(getSoundUrl(sound));
      element.loop = true;
      element.preload = 'auto';
      element.crossOrigin = 'anonymous';
      element.volume = 1;

      const source = this.context.createMediaElementSource(element);
      const gainNode = this.context.createGain();
      gainNode.gain.value = 0;

      source.connect(gainNode).connect(this.masterGain);

      this.sounds.set(sound.id, { id: sound.id, element, source, gainNode });
    }
  }

  async resume() {
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  setMasterVolume(volume: number, fadeMs = DEFAULT_FADE_MS) {
    const now = this.context.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    if (fadeMs <= 0) {
      this.masterGain.gain.setValueAtTime(volume, now);
    } else {
      this.masterGain.gain.linearRampToValueAtTime(volume, now + fadeMs / 1000);
    }
  }

  setSoundVolume(soundId: string, volume: number, fadeMs = DEFAULT_FADE_MS) {
    const entry = this.sounds.get(soundId);
    if (!entry) {
      return;
    }

    const now = this.context.currentTime;
    entry.gainNode.gain.cancelScheduledValues(now);
    if (fadeMs <= 0) {
      entry.gainNode.gain.setValueAtTime(volume, now);
    } else {
      entry.gainNode.gain.linearRampToValueAtTime(volume, now + fadeMs / 1000);
    }

    if (volume > 0 && this.isPlaying) {
      void entry.element.play().catch((error) => {
        console.warn('Audio playback failed', error);
      });
    } else if (volume <= 0) {
      if (entry.stopTimer) {
        clearTimeout(entry.stopTimer);
      }
      entry.stopTimer = setTimeout(() => {
        if (entry.gainNode.gain.value <= 0.0001) {
          entry.element.pause();
        }
      }, fadeMs + 50);
    }
  }

  syncVolumes(gains: Record<string, number>, fadeMs = DEFAULT_FADE_MS) {
    Object.entries(gains).forEach(([soundId, volume]) => {
      this.setSoundVolume(soundId, volume, fadeMs);
    });
  }

  async play() {
    this.isPlaying = true;
    await this.resume();
    await Promise.all(
      Array.from(this.sounds.values()).map(async (item) => {
        if (item.gainNode.gain.value > 0) {
          try {
            await item.element.play();
          } catch (error) {
            console.warn('Failed to start audio element', error);
          }
        }
      })
    );
  }

  pause() {
    this.isPlaying = false;
    this.sounds.forEach((item) => {
      item.element.pause();
    });
  }

  dispose() {
    this.sounds.forEach((item) => {
      item.element.pause();
      item.element.src = '';
      item.source.disconnect();
      item.gainNode.disconnect();
    });
    this.sounds.clear();
    this.masterGain.disconnect();
    void this.context.close();
  }
}

export function useAudioEngine(sounds: SoundDefinition[]) {
  const engine = useRef<MixerAudioEngine | null>(null);
  const mix = useMixerStore((state) => state.mix);

  useEffect(() => {
    engine.current = new MixerAudioEngine(sounds);
    return () => {
      engine.current?.dispose();
      engine.current = null;
    };
  }, [sounds]);

  useEffect(() => {
    if (!engine.current) {
      return;
    }
    engine.current.setMasterVolume(mix.masterVolume);
  }, [mix.masterVolume]);

  useEffect(() => {
    if (!engine.current) {
      return;
    }
    engine.current.syncVolumes(mix.gains);
  }, [mix.gains]);

  useEffect(() => {
    if (!engine.current) {
      return;
    }
    if (mix.isPlaying) {
      void engine.current.play();
    } else {
      engine.current.pause();
    }
  }, [mix.isPlaying]);

  return useMemo(
    () => ({
      async resume() {
        await engine.current?.resume();
      }
    }),
    []
  );
}
