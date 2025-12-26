import { soundDefinitionSchema, type SoundDefinition } from './types';

const sounds: SoundDefinition[] = [
  {
    id: 'rain-shower',
    name: 'Gentle Rain',
    category: 'nature',
    emoji: '🌧️',
    color: '#4f7cac',
    file: { path: '/audio/rain-shower.mp3', format: 'mp3', loop: true, normalized: true },
    defaultVolume: 0.7,
    order: 1,
    description: 'Soft rainfall recorded under a covered patio.'
  },
  {
    id: 'distant-thunder',
    name: 'Distant Thunder',
    category: 'nature',
    emoji: '⛈️',
    color: '#3b3c61',
    file: { path: '/audio/distant-thunder.mp3', format: 'mp3', loop: true, normalized: true },
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
    file: { path: '/audio/ocean-tide.mp3', format: 'mp3', loop: true, normalized: true },
    defaultVolume: 0.6,
    order: 3,
    description: 'Rolling ocean tide captured at dusk.'
  },
  {
    id: 'forest-birds',
    name: 'Forest Birds',
    category: 'nature',
    emoji: '🐦',
    color: '#5c946e',
    file: { path: '/audio/forest-birds.mp3', format: 'mp3', loop: true, normalized: true },
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
    file: { path: '/audio/city-cafe.mp3', format: 'mp3', loop: true, normalized: true },
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
    file: { path: '/audio/midnight-train.mp3', format: 'mp3', loop: true, normalized: true },
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
    file: { path: '/audio/city-hum.mp3', format: 'mp3', loop: true, normalized: true },
    defaultVolume: 0.5,
    order: 7,
    description: 'Ambient downtown hum with subtle traffic textures.'
  },
  {
    id: 'cozy-fireplace',
    name: 'Fireplace',
    category: 'home',
    emoji: '🔥',
    color: '#d95d39',
    file: { path: '/audio/cozy-fireplace.mp3', format: 'mp3', loop: true, normalized: true },
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
    file: { path: '/audio/keyboard-typing.mp3', format: 'mp3', loop: true, normalized: true },
    defaultVolume: 0.4,
    order: 9,
    description: 'Mechanical keyboard typing at a steady pace.'
  },
  {
    id: 'lofi-piano',
    name: 'Lo-fi Piano',
    category: 'tones',
    emoji: '🎹',
    color: '#9c95dc',
    file: { path: '/audio/lofi-piano.mp3', format: 'mp3', loop: true, normalized: true },
    defaultVolume: 0.45,
    order: 10,
    description: 'Soft, lightly detuned piano progression.'
  },
  {
    id: 'brown-noise',
    name: 'Brown Noise',
    category: 'tones',
    emoji: '🟤',
    color: '#836953',
    file: { path: '/audio/brown-noise.mp3', format: 'mp3', loop: true, normalized: true },
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
    file: { path: '/audio/airy-wind.mp3', format: 'mp3', loop: true, normalized: true },
    defaultVolume: 0.5,
    order: 12,
    description: 'Soft gusts through leaves with gentle whoosh.'
  }
];

export const soundLibrary = soundDefinitionSchema.array().parse(sounds);

export function getSoundById(id: string) {
  return soundLibrary.find((sound) => sound.id === id);
}

export function listSoundsByCategory(category: string) {
  return soundLibrary.filter((sound) => sound.category === category);
}
