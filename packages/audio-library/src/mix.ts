import { mixStateSchema, type MixState, type PresetSoundSetting, type SoundId } from './types';
import { normalizePresetMix } from './presets';

export const DEFAULT_MASTER_VOLUME = 0.8;
export const DEFAULT_FADE_MS = 200;

export function clampVolume(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

export function createEmptyMix(soundIds: SoundId[], masterVolume = DEFAULT_MASTER_VOLUME): MixState {
  const gains = soundIds.reduce<Record<string, number>>((acc, id) => {
    acc[id] = 0;
    return acc;
  }, {});

  return mixStateSchema.parse({
    isPlaying: false,
    masterVolume: clampVolume(masterVolume),
    gains
  });
}

export function applyPresetToMix(
  state: MixState,
  presetMix: PresetSoundSetting[],
  options?: { masterVolume?: number }
): MixState {
  const normalized = normalizePresetMix(presetMix);
  const gains = { ...state.gains };

  normalized.forEach((item) => {
    gains[item.soundId] = item.volume;
  });

  const masterVolume = options?.masterVolume ?? state.masterVolume;

  return mixStateSchema.parse({
    isPlaying: state.isPlaying,
    masterVolume: clampVolume(masterVolume),
    gains
  });
}

export function toggleSound(state: MixState, soundId: SoundId, volumeWhenEnabled = 0.5): MixState {
  const current = state.gains[soundId] ?? 0;
  const nextVolume = current > 0 ? 0 : clampVolume(volumeWhenEnabled);

  return mixStateSchema.parse({
    ...state,
    gains: {
      ...state.gains,
      [soundId]: nextVolume
    }
  });
}

export function setSoundVolume(state: MixState, soundId: SoundId, volume: number): MixState {
  return mixStateSchema.parse({
    ...state,
    gains: {
      ...state.gains,
      [soundId]: clampVolume(volume)
    }
  });
}

export function setMasterVolume(state: MixState, volume: number): MixState {
  return mixStateSchema.parse({
    ...state,
    masterVolume: clampVolume(volume)
  });
}

export function serializeMix(state: MixState): PresetSoundSetting[] {
  return Object.entries(state.gains)
    .filter(([, volume]) => volume > 0)
    .map(([soundId, volume]) => ({ soundId, volume }));
}
