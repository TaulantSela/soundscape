import { synthSpecs } from './generators';
import { renderSpec, type RenderSoundOptions, type RenderedSound } from './render';

export { SYNTH_VERSION, DEFAULT_SYNTH_SAMPLE_RATE } from './render';
export type { RenderSoundOptions, RenderedSound } from './render';
export { encodeWav } from './wav';

export function hasSynth(soundId: string) {
  return Object.prototype.hasOwnProperty.call(synthSpecs, soundId);
}

/**
 * Render a seamless, level-matched loop for a sound. Rendering is
 * deterministic: the same sound and options always give identical samples.
 */
export function renderSound(soundId: string, options?: RenderSoundOptions): RenderedSound {
  if (!hasSynth(soundId)) {
    throw new Error(`No synthesizer for sound "${soundId}"`);
  }
  return renderSpec(soundId, synthSpecs[soundId], options);
}
