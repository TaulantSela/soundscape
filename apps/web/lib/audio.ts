import type { SoundDefinition } from '@soundscape/audio-library';
import { buildAssetUrl } from '@soundscape/config';
import { appConfig } from './config';

/** URL of a sound's recorded loop, or `undefined` for synthesized sounds. */
export function getSoundUrl(sound: SoundDefinition) {
  return sound.file ? buildAssetUrl(appConfig, sound.file.path) : undefined;
}
