'use client';

import {
  DEFAULT_MASTER_VOLUME,
  applyPresetToMix,
  clampVolume,
  createEmptyMix,
  serializeMix,
  setMasterVolume as updateMasterVolume,
  setSoundVolume as updateSoundVolume,
  toggleSound as toggleSoundValue,
  type MixState,
  type PresetDefinition,
  type PresetSoundSetting,
  type SoundDefinition
} from '@soundscape/audio-library';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface MixerStore {
  sounds: SoundDefinition[];
  presets: PresetDefinition[];
  mix: MixState;
  activePresetId?: string;
  hydrated: boolean;
  initialize: (sounds: SoundDefinition[], presets: PresetDefinition[]) => void;
  setPresets: (presets: PresetDefinition[]) => void;
  toggleSound: (soundId: string) => void;
  setSoundVolume: (soundId: string, volume: number) => void;
  setMasterVolume: (volume: number) => void;
  setPlaying: (isPlaying: boolean) => void;
  togglePlaying: () => void;
  applyPreset: (presetId: string) => void;
  clearActivePreset: () => void;
  loadMix: (payload: { sounds: PresetSoundSetting[]; masterVolume?: number }) => void;
  serialize: () => PresetSoundSetting[];
  markHydrated: () => void;
}

const initialMix = createEmptyMix([], DEFAULT_MASTER_VOLUME);

export const useMixerStore = create<MixerStore>()(
  persist(
    (set, get) => ({
      sounds: [],
      presets: [],
      mix: initialMix,
      activePresetId: undefined,
      hydrated: false,
      initialize: (sounds, presets) => {
        const soundIds = sounds.map((sound) => sound.id);
        const currentMix = get().mix ?? initialMix;
        const nextMix = ensureMixAlignment(currentMix, soundIds);
        set({
          sounds,
          presets,
          mix: nextMix,
          hydrated: true
        });
      },
      setPresets: (presets) => set({ presets }),
      toggleSound: (soundId) => {
        set((state) => ({
          mix: toggleSoundValue(state.mix, soundId),
          activePresetId: undefined
        }));
      },
      setSoundVolume: (soundId, volume) => {
        set((state) => ({
          mix: updateSoundVolume(state.mix, soundId, volume),
          activePresetId: undefined
        }));
      },
      setMasterVolume: (volume) => {
        set((state) => ({
          mix: updateMasterVolume(state.mix, volume)
        }));
      },
      setPlaying: (isPlaying) => {
        set((state) => ({
          mix: { ...state.mix, isPlaying }
        }));
      },
      togglePlaying: () => {
        set((state) => ({
          mix: { ...state.mix, isPlaying: !state.mix.isPlaying }
        }));
      },
      applyPreset: (presetId) => {
        const preset = get().presets.find((item) => item.id === presetId);
        if (!preset) {
          return;
        }
        set((state) => ({
          mix: { ...applyPresetToMix(state.mix, preset.mix), isPlaying: true },
          activePresetId: presetId
        }));
      },
      clearActivePreset: () => set({ activePresetId: undefined }),
      loadMix: ({ sounds, masterVolume }) => {
        const soundIds = get().sounds.map((sound) => sound.id);
        const alignedMix = ensureMixAlignment(get().mix, soundIds);
        const next = sounds.reduce<Record<string, number>>((acc, item) => {
          acc[item.soundId] = clampVolume(item.volume);
          return acc;
        }, { ...alignedMix.gains });

        set((state) => ({
          mix: {
            ...state.mix,
            gains: next,
            masterVolume: clampVolume(masterVolume ?? state.mix.masterVolume)
          },
          activePresetId: undefined
        }));
      },
      serialize: () => serializeMix(get().mix),
      markHydrated: () => set({ hydrated: true })
    }),
    {
      name: 'soundscape.mixer',
      skipHydration: true,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({ mix: state.mix, activePresetId: state.activePresetId }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Failed to rehydrate mixer store', error);
          return;
        }
        state?.markHydrated();
      }
    }
  )
);

export function rehydrateMixerStore() {
  return useMixerStore.persist.rehydrate();
}

function ensureMixAlignment(mix: MixState, soundIds: string[]) {
  const nextGains = soundIds.reduce<Record<string, number>>((acc, id) => {
    acc[id] = clampVolume(mix.gains[id] ?? 0);
    return acc;
  }, {});

  return {
    ...mix,
    gains: nextGains
  };
}
