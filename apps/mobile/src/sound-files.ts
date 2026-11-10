import {
  SYNTH_VERSION,
  encodeWav,
  renderSound,
  type SoundDefinition,
} from '@soundscape/audio-library';
import { buildAssetUrl } from '@soundscape/config';
import { File, Paths } from 'expo-file-system';

import { appConfig } from './config';

// Mono at 22.05 kHz keeps rendering quick on the JS thread and each file small.
const MOBILE_SAMPLE_RATE = 22050;

const pending = new Map<string, Promise<string>>();

function yieldToUi() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function renderToCache(sound: SoundDefinition) {
  const file = new File(Paths.cache, `soundscape-v${SYNTH_VERSION}-${sound.id}.wav`);
  if (!file.exists) {
    // Let the tap that switched the sound on finish rendering first.
    await yieldToUi();
    const rendered = renderSound(sound.id, { sampleRate: MOBILE_SAMPLE_RATE, channels: 1 });
    file.write(encodeWav(rendered));
  }
  return file.uri;
}

/**
 * A playable URI for a sound: its recording if it has one, otherwise a
 * synthesized loop rendered once and cached on the device.
 */
export function resolveSoundUri(sound: SoundDefinition): Promise<string> {
  if (sound.file) {
    const url = buildAssetUrl(appConfig, sound.file.path);
    // Relative asset paths are served by the web app.
    return Promise.resolve(url.startsWith('/') ? `${appConfig.appUrl}${url}` : url);
  }

  let uri = pending.get(sound.id);
  if (!uri) {
    uri = renderToCache(sound).catch((error: unknown) => {
      pending.delete(sound.id);
      throw error;
    });
    pending.set(sound.id, uri);
  }
  return uri;
}
