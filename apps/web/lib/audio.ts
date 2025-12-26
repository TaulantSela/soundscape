import type { SoundDefinition } from '@soundscape/audio-library';
import { buildAssetUrl } from '@soundscape/config';
import { appConfig } from './config';

export function getSoundUrl(sound: SoundDefinition) {
  return buildAssetUrl(appConfig, sound.file.path);
}
