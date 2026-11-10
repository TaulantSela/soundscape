import { soundDefinitionSchema, type SoundDefinition } from './types';

// None of these sounds ship a recording yet: each one is synthesized on the
// device from `synth/generators.ts`. To use a recording instead, add
// `file: { path: '/audio/<id>.mp3', format: 'mp3' }` to the definition.
const sounds: SoundDefinition[] = [
  {
    id: 'rain-shower',
    name: 'Gentle Rain',
    category: 'nature',
    emoji: '🌧️',
    color: '#4f7cac',
    defaultVolume: 0.7,
    order: 1,
    description: 'Soft, steady rainfall with light droplets.'
  },
  {
    id: 'distant-thunder',
    name: 'Distant Thunder',
    category: 'nature',
    emoji: '⛈️',
    color: '#3b3c61',
    defaultVolume: 0.4,
    order: 2,
    description: 'Low rumbles of thunder with long tails.'
  },
  {
    id: 'ocean-tide',
    name: 'Ocean Tide',
    category: 'nature',
    emoji: '🌊',
    color: '#2a6f97',
    defaultVolume: 0.6,
    order: 3,
    description: 'Slow waves rolling in and washing back out.'
  },
  {
    id: 'forest-birds',
    name: 'Forest Birds',
    category: 'nature',
    emoji: '🐦',
    color: '#5c946e',
    defaultVolume: 0.5,
    order: 4,
    description: 'Light songbirds with distant wind in trees.'
  },
  {
    id: 'city-cafe',
    name: 'Café Murmur',
    category: 'urban',
    emoji: '☕️',
    color: '#b85c38',
    defaultVolume: 0.55,
    order: 5,
    description: 'Quiet café ambience with soft conversations.'
  },
  {
    id: 'midnight-train',
    name: 'Night Train',
    category: 'urban',
    emoji: '🚆',
    color: '#2d4654',
    defaultVolume: 0.45,
    order: 6,
    description: 'Steady train ride with rhythmic track clatter.'
  },
  {
    id: 'city-hum',
    name: 'City Hum',
    category: 'urban',
    emoji: '🌆',
    color: '#6c757d',
    defaultVolume: 0.5,
    order: 7,
    description: 'Ambient downtown hum with distant passing traffic.'
  },
  {
    id: 'cozy-fireplace',
    name: 'Fireplace',
    category: 'home',
    emoji: '🔥',
    color: '#d95d39',
    defaultVolume: 0.5,
    order: 8,
    description: 'Crackling logs with occasional pops.'
  },
  {
    id: 'keyboard-typing',
    name: 'Keyboard Typing',
    category: 'home',
    emoji: '⌨️',
    color: '#8d99ae',
    defaultVolume: 0.4,
    order: 9,
    description: 'Keyboard typing at a steady, unhurried pace.'
  },
  {
    id: 'lofi-piano',
    name: 'Lo-fi Piano',
    category: 'tones',
    emoji: '🎹',
    color: '#9c95dc',
    defaultVolume: 0.45,
    order: 10,
    description: 'Soft, slightly wobbly piano chords.'
  },
  {
    id: 'brown-noise',
    name: 'Brown Noise',
    category: 'tones',
    emoji: '🟤',
    color: '#836953',
    defaultVolume: 0.35,
    order: 11,
    description: 'Low-end focused brown noise for masking distractions.'
  },
  {
    id: 'airy-wind',
    name: 'Airy Wind',
    category: 'nature',
    emoji: '🌬️',
    color: '#adb5bd',
    defaultVolume: 0.5,
    order: 12,
    description: 'Soft gusts through leaves with a gentle whoosh.'
  }
];

export const soundLibrary = soundDefinitionSchema.array().parse(sounds);

export const soundIds = soundLibrary.map((sound) => sound.id);

export function getSoundById(id: string) {
  return soundLibrary.find((sound) => sound.id === id);
}

export function listSoundsByCategory(category: string) {
  return soundLibrary.filter((sound) => sound.category === category);
}
