import { createRng, hashString, panGains, type Rng } from './dsp';

/**
 * Bump when a generator changes, so clients that cache rendered loops (the
 * mobile app writes them to disk) re-render instead of reusing stale audio.
 */
export const SYNTH_VERSION = 1;

export const DEFAULT_SYNTH_SAMPLE_RATE = 32000;

export interface SynthContext {
  sampleRate: number;
  channelCount: 1 | 2;
  loopSeconds: number;
  /** Samples in one loop. */
  loopLength: number;
  /** Samples in each `bed` channel: one loop plus the crossfade tail. */
  bedLength: number;
  /**
   * Continuous textures (noise, wind, waves). Rendered straight through and
   * then crossfaded end-into-start, so the loop point is inaudible.
   */
  bed: Float32Array[];
  /**
   * Discrete events (drops, chirps, keys, notes). Written with wrap-around, so
   * a tail that runs past the end of the loop continues at its start.
   */
  events: Float32Array[];
  /** Per-sound random source, shared by both channels. */
  rng: Rng;
  /** Independent random source per channel, for decorrelated stereo noise. */
  channelRng(channel: number, salt?: string): Rng;
}

export interface SynthSpec {
  loopSeconds: number;
  crossfadeSeconds: number;
  /** Loudness target after rendering; keeps the sounds level-matched. */
  targetRms: number;
  render(ctx: SynthContext): void;
}

export interface RenderSoundOptions {
  sampleRate?: number;
  channels?: 1 | 2;
}

export interface RenderedSound {
  sampleRate: number;
  channels: Float32Array[];
  loopSeconds: number;
}

/**
 * Add a discrete event into the circular event buffer. `sample` is called once
 * per output sample, in order, so it may keep filter or phase state.
 */
export function addEvent(
  ctx: SynthContext,
  startSeconds: number,
  durationSeconds: number,
  pan: number,
  sample: (index: number, seconds: number) => number
) {
  const { sampleRate, loopLength, events, channelCount } = ctx;
  const length = Math.min(Math.round(durationSeconds * sampleRate), loopLength);
  const start = ((Math.round(startSeconds * sampleRate) % loopLength) + loopLength) % loopLength;
  const [left, right] = channelCount === 2 ? panGains(pan) : [1, 1];
  const first = events[0];
  const second = channelCount === 2 ? events[1] : undefined;

  for (let i = 0; i < length; i++) {
    const value = sample(i, i / sampleRate);
    let index = start + i;
    if (index >= loopLength) {
      index -= loopLength;
    }
    first[index] += value * left;
    if (second) {
      second[index] += value * right;
    }
  }
}

/** Run `fill` once per bed channel with that channel's own random source. */
export function forEachBedChannel(
  ctx: SynthContext,
  salt: string,
  fill: (out: Float32Array, rng: Rng, channel: number) => void
) {
  for (let channel = 0; channel < ctx.channelCount; channel++) {
    fill(ctx.bed[channel], ctx.channelRng(channel, salt), channel);
  }
}

function makeSeamless(bed: Float32Array, loopLength: number, fadeLength: number) {
  const out = bed.slice(0, loopLength);
  for (let i = 0; i < fadeLength; i++) {
    // Equal-power crossfade: the start of the loop fades in while the audio
    // that followed the loop's end fades out over it.
    const t = (i / fadeLength) * (Math.PI / 2);
    out[i] = bed[i] * Math.sin(t) + bed[loopLength + i] * Math.cos(t);
  }
  return out;
}

function normalize(channels: Float32Array[], targetRms: number) {
  let sumSquares = 0;
  let peak = 0;
  let count = 0;
  for (const channel of channels) {
    for (const value of channel) {
      sumSquares += value * value;
      const magnitude = Math.abs(value);
      if (magnitude > peak) {
        peak = magnitude;
      }
    }
    count += channel.length;
  }

  const rms = Math.sqrt(sumSquares / Math.max(count, 1));
  if (rms === 0) {
    return;
  }

  let gain = targetRms / rms;
  if (peak * gain > 0.95) {
    gain = 0.95 / peak;
  }

  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      channel[i] *= gain;
    }
  }
}

export function renderSpec(
  soundId: string,
  spec: SynthSpec,
  options: RenderSoundOptions = {}
): RenderedSound {
  const sampleRate = options.sampleRate ?? DEFAULT_SYNTH_SAMPLE_RATE;
  const channelCount = options.channels ?? 2;
  const loopLength = Math.round(spec.loopSeconds * sampleRate);
  const fadeLength = Math.round(spec.crossfadeSeconds * sampleRate);
  const bedLength = loopLength + fadeLength;

  const ctx: SynthContext = {
    sampleRate,
    channelCount,
    loopSeconds: spec.loopSeconds,
    loopLength,
    bedLength,
    bed: Array.from({ length: channelCount }, () => new Float32Array(bedLength)),
    events: Array.from({ length: channelCount }, () => new Float32Array(loopLength)),
    rng: createRng(hashString(soundId)),
    channelRng: (channel, salt = '') => createRng(hashString(`${soundId}:${channel}:${salt}`))
  };

  spec.render(ctx);

  const channels = ctx.bed.map((bed, channel) => {
    const out = makeSeamless(bed, loopLength, fadeLength);
    const events = ctx.events[channel];
    for (let i = 0; i < loopLength; i++) {
      out[i] += events[i];
    }
    return out;
  });

  normalize(channels, spec.targetRms);

  return { sampleRate, channels, loopSeconds: spec.loopSeconds };
}
