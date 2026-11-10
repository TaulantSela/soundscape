import { presetDefinitionSchema, type PresetDefinition, type PresetSoundSetting } from './types';
import { clampVolume } from './volume';

const presetSource: PresetDefinition[] = [
  {
    id: 'focus-flow',
    name: 'Focus Flow',
    emoji: '🎯',
    color: '#457b9d',
    description: 'Steady rain with noise masking for deep focus.',
    tags: ['focus', 'productivity'],
    mix: [
      { soundId: 'rain-shower', volume: 0.6 },
      { soundId: 'brown-noise', volume: 0.35 },
      { soundId: 'keyboard-typing', volume: 0.22 }
    ]
  },
  {
    id: 'deep-work',
    name: 'Deep Work',
    emoji: '🧠',
    color: '#1d3557',
    description: 'Low-end noise with subtle melody for flow sessions.',
    tags: ['focus', 'study'],
    mix: [
      { soundId: 'brown-noise', volume: 0.42 },
      { soundId: 'lofi-piano', volume: 0.3 },
      { soundId: 'city-hum', volume: 0.2 }
    ]
  },
  {
    id: 'cozy-night',
    name: 'Cozy Night',
    emoji: '🛋️',
    color: '#ff9f87',
    description: 'Crackling fire with soft piano for evening wind-down.',
    tags: ['relax', 'evening'],
    mix: [
      { soundId: 'cozy-fireplace', volume: 0.64 },
      { soundId: 'lofi-piano', volume: 0.32 }
    ]
  },
  {
    id: 'sleep-drift',
    name: 'Sleep Drift',
    emoji: '😴',
    color: '#264653',
    description: 'Gentle ocean with distant wind to lull you to sleep.',
    tags: ['sleep'],
    mix: [
      { soundId: 'ocean-tide', volume: 0.5 },
      { soundId: 'airy-wind', volume: 0.32 },
      { soundId: 'distant-thunder', volume: 0.18 }
    ]
  },
  {
    id: 'train-ride',
    name: 'Train Ride',
    emoji: '🚞',
    color: '#6c5b7b',
    description: 'Rhythmic train tracks with city undertones.',
    tags: ['travel'],
    mix: [
      { soundId: 'midnight-train', volume: 0.58 },
      { soundId: 'city-hum', volume: 0.32 },
      { soundId: 'brown-noise', volume: 0.18 }
    ]
  },
  {
    id: 'reading-nook',
    name: 'Reading Nook',
    emoji: '📚',
    color: '#e9c46a',
    description: 'Warm café, fireplace, and light piano for reading.',
    tags: ['reading', 'calm'],
    mix: [
      { soundId: 'city-cafe', volume: 0.45 },
      { soundId: 'cozy-fireplace', volume: 0.34 },
      { soundId: 'lofi-piano', volume: 0.3 },
      { soundId: 'forest-birds', volume: 0.18 }
    ]
  }
];

export const builtInPresets = presetDefinitionSchema.array().parse(presetSource);

export const builtInPresetIds = builtInPresets.map((preset) => preset.id);

export function getPresetById(id: string) {
  return builtInPresets.find((preset) => preset.id === id);
}

export function buildGainMapFromPreset(preset: PresetDefinition) {
  return normalizePresetMix(preset.mix).reduce<Record<string, number>>((acc, item) => {
    acc[item.soundId] = item.volume;
    return acc;
  }, {});
}

export function normalizePresetMix(mix: PresetSoundSetting[]) {
  const seen = new Set<string>();
  return mix
    .filter((item) => {
      if (seen.has(item.soundId)) {
        return false;
      }
      seen.add(item.soundId);
      return true;
    })
    .map((item) => ({
      soundId: item.soundId,
      volume: clampVolume(item.volume)
    }));
}

export function validatePreset(input: unknown) {
  return presetDefinitionSchema.safeParse(input);
}
