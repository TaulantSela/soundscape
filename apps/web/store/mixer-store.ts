'use client';

import {
  DEFAULT_ENABLE_VOLUME,
  DEFAULT_MASTER_VOLUME,
  applyPresetToMix,
  clampVolume,
  createEmptyMix,
  hasActiveSounds,
  serializeMix,
  setMasterVolume as updateMasterVolume,
  setSoundVolume as updateSoundVolume,
  toggleSound as toggleSoundValue,
  type MixState,
  type PresetDefinition,
  type PresetSoundSetting,
  type SharedMix,
  type SoundDefinition
} from '@soundscape/audio-library';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

/**
 * `personal`: the visitor's own mix, saved to localStorage.
 * `shared`: a mix opened from a link. It is never saved unless the visitor
 * chooses to keep it, so opening a link can't overwrite their own mix.
 */
export type MixerMode = 'personal' | 'shared';

export interface MixerStore {
  sounds: SoundDefinition[];
  presets: PresetDefinition[];
  mix: MixState;
  /** Last non-zero volume per sound, restored when a sound is switched back on. */
  lastVolumes: Record<string, number>;
  activePresetId?: string;
  hydrated: boolean;
  mode: MixerMode;
  startPersonalSession: (sounds: SoundDefinition[], presets: PresetDefinition[]) => Promise<void>;
  startSharedSession: (sounds: SoundDefinition[], presets: PresetDefinition[], sharedMix: SharedMix) => void;
  keepSharedMix: () => void;
  toggleSound: (soundId: string) => void;
  setSoundVolume: (soundId: string, volume: number) => void;
  setMasterVolume: (volume: number) => void;
  setPlaying: (isPlaying: boolean) => void;
  togglePlaying: () => void;
  applyPreset: (presetId: string) => void;
  serialize: () => PresetSoundSetting[];
}

interface PersistedMixerState {
  mix?: { gains?: Record<string, unknown>; masterVolume?: unknown };
  lastVolumes?: Record<string, unknown>;
  activePresetId?: unknown;
}

// Writes are switched off while a session is being set up and while a shared
// mix is open, so neither can clobber what the visitor saved.
let persistenceEnabled = false;

const guardedLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    if (!persistenceEnabled) {
      return;
    }
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // Storage full or blocked (private mode); the mix still works in memory.
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      // Ignore.
    }
  }
};

function toVolume(value: unknown) {
  return typeof value === 'number' ? clampVolume(value) : 0;
}

function sanitizeVolumes(raw: Record<string, unknown> | undefined, soundIds: string[]) {
  const volumes: Record<string, number> = {};
  for (const id of soundIds) {
    const volume = toVolume(raw?.[id]);
    if (volume > 0) {
      volumes[id] = volume;
    }
  }
  return volumes;
}

const emptyMix = createEmptyMix([], DEFAULT_MASTER_VOLUME);

export const useMixerStore = create<MixerStore>()(
  persist(
    (set, get) => ({
      sounds: [],
      presets: [],
      mix: emptyMix,
      lastVolumes: {},
      activePresetId: undefined,
      hydrated: false,
      mode: 'personal',

      startPersonalSession: async (sounds, presets) => {
        persistenceEnabled = false;
        set({
          sounds,
          presets,
          mode: 'personal',
          hydrated: false,
          mix: createEmptyMix(
            sounds.map((sound) => sound.id),
            DEFAULT_MASTER_VOLUME
          ),
          lastVolumes: {},
          activePresetId: undefined
        });

        try {
          await useMixerStore.persist.rehydrate();
        } catch (error) {
          console.error('Failed to restore the saved mix', error);
        }

        persistenceEnabled = true;
        set({ hydrated: true });
      },

      startSharedSession: (sounds, presets, sharedMix) => {
        persistenceEnabled = false;
        const base = createEmptyMix(
          sounds.map((sound) => sound.id),
          sharedMix.masterVolume
        );
        set({
          sounds,
          presets,
          mode: 'shared',
          hydrated: true,
          // Replace, never merge: the shared mix is exactly what was shared.
          mix: applyPresetToMix(base, sharedMix.sounds),
          lastVolumes: Object.fromEntries(sharedMix.sounds.map((item) => [item.soundId, item.volume])),
          activePresetId: undefined
        });
      },

      keepSharedMix: () => {
        persistenceEnabled = true;
        set({ mode: 'personal' });
      },

      toggleSound: (soundId) => {
        set((state) => {
          const sound = state.sounds.find((item) => item.id === soundId);
          const enableVolume = state.lastVolumes[soundId] ?? sound?.defaultVolume ?? DEFAULT_ENABLE_VOLUME;
          const mix = toggleSoundValue(state.mix, soundId, enableVolume);
          const turnedOn = (mix.gains[soundId] ?? 0) > 0;
          // Switching a sound on starts playback; switching the last one off stops it.
          const isPlaying = turnedOn || (state.mix.isPlaying && hasActiveSounds(mix));

          return {
            mix: { ...mix, isPlaying },
            activePresetId: undefined,
            lastVolumes: turnedOn ? { ...state.lastVolumes, [soundId]: mix.gains[soundId] } : state.lastVolumes
          };
        });
      },

      setSoundVolume: (soundId, volume) => {
        set((state) => {
          const mix = updateSoundVolume(state.mix, soundId, volume);
          const applied = mix.gains[soundId] ?? 0;
          return {
            mix,
            activePresetId: undefined,
            lastVolumes: applied > 0 ? { ...state.lastVolumes, [soundId]: applied } : state.lastVolumes
          };
        });
      },

      setMasterVolume: (volume) => {
        set((state) => ({ mix: updateMasterVolume(state.mix, volume) }));
      },

      setPlaying: (isPlaying) => {
        set((state) => {
          if (isPlaying && !hasActiveSounds(state.mix)) {
            return {};
          }
          return { mix: { ...state.mix, isPlaying } };
        });
      },

      togglePlaying: () => {
        get().setPlaying(!get().mix.isPlaying);
      },

      applyPreset: (presetId) => {
        const preset = get().presets.find((item) => item.id === presetId);
        if (!preset) {
          return;
        }
        set((state) => ({
          mix: { ...applyPresetToMix(state.mix, preset.mix), isPlaying: true },
          activePresetId: presetId,
          lastVolumes: {
            ...state.lastVolumes,
            ...Object.fromEntries(preset.mix.map((item) => [item.soundId, item.volume]))
          }
        }));
      },

      serialize: () => serializeMix(get().mix)
    }),
    {
      name: 'soundscape.mixer',
      // v0 also stored `isPlaying`, which restored a "playing" UI that the
      // browser's autoplay policy would never let make a sound.
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => guardedLocalStorage),
      partialize: (state): PersistedMixerState => ({
        mix: { gains: state.mix.gains, masterVolume: state.mix.masterVolume },
        lastVolumes: state.lastVolumes,
        activePresetId: state.activePresetId
      }),
      migrate: (persisted) => persisted as PersistedMixerState,
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as PersistedMixerState;
        const soundIds = Object.keys(current.mix.gains);
        const gains = Object.fromEntries(soundIds.map((id) => [id, toVolume(saved.mix?.gains?.[id])]));
        const masterVolume =
          typeof saved.mix?.masterVolume === 'number' ? clampVolume(saved.mix.masterVolume) : current.mix.masterVolume;
        const activePresetId = typeof saved.activePresetId === 'string' ? saved.activePresetId : undefined;

        return {
          ...current,
          mix: { isPlaying: false, masterVolume, gains },
          lastVolumes: sanitizeVolumes(saved.lastVolumes, soundIds),
          activePresetId: current.presets.some((preset) => preset.id === activePresetId) ? activePresetId : undefined
        };
      }
    }
  )
);
