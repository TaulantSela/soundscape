import type { PresetSoundSetting } from '@soundscape/audio-library';

export interface MixPayload {
  name?: string;
  sounds: PresetSoundSetting[];
  masterVolume: number;
}

export interface MixResponse {
  id: string;
  name?: string;
  createdAt: string;
  sounds: PresetSoundSetting[];
  masterVolume: number;
}
