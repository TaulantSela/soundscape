import { mixStateSchema, type MixState, type PresetSoundSetting, type SoundId } from './types';
import { normalizePresetMix } from './presets';
import { clampVolume } from './volume';

export const DEFAULT_MASTER_VOLUME = 0.8;
export const DEFAULT_FADE_MS = 200;
/** Volume used when a sound is switched on and nothing better is known. */
export const DEFAULT_ENABLE_VOLUME = 0.5;

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

/**
 * Replace every layer of the mix with the given settings: sounds that are not
 * listed are switched off. Used for presets and for loading a shared mix.
 */
export function applyPresetToMix(
  state: MixState,
  presetMix: PresetSoundSetting[],
  options?: { masterVolume?: number }
): MixState {
  const gains = Object.keys(state.gains).reduce<Record<string, number>>((acc, id) => {
    acc[id] = 0;
    return acc;
  }, {});

  normalizePresetMix(presetMix).forEach((item) => {
    gains[item.soundId] = item.volume;
  });

  const masterVolume = options?.masterVolume ?? state.masterVolume;

  return mixStateSchema.parse({
    isPlaying: state.isPlaying,
    masterVolume: clampVolume(masterVolume),
    gains
  });
}

/**
 * Switch a sound off, or back on at `volumeWhenEnabled` (callers pass the
 * sound's last-used or default volume).
 */
export function toggleSound(
  state: MixState,
  soundId: SoundId,
  volumeWhenEnabled = DEFAULT_ENABLE_VOLUME
): MixState {
  const current = state.gains[soundId] ?? 0;
  const enabledVolume = clampVolume(volumeWhenEnabled) || DEFAULT_ENABLE_VOLUME;
  const nextVolume = current > 0 ? 0 : enabledVolume;

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

export function hasActiveSounds(state: Pick<MixState, 'gains'>) {
  return Object.values(state.gains).some((volume) => volume > 0);
}

export function serializeMix(state: Pick<MixState, 'gains'>): PresetSoundSetting[] {
  return Object.entries(state.gains)
    .filter(([, volume]) => volume > 0)
    .map(([soundId, volume]) => ({ soundId, volume }));
}
