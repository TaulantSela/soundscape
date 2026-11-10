// Small, dependency-free DSP helpers for the sound synthesizer. Everything here
// runs per sample, so it stays allocation-free inside the hot paths.

export type Rng = () => number;

/** Deterministic PRNG (mulberry32), so every render of a sound is identical. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash, used to derive per-sound and per-channel seeds. */
export function hashString(value: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function range(rng: Rng, min: number, max: number) {
  return min + (max - min) * rng();
}

export function white(rng: Rng) {
  return rng() * 2 - 1;
}

/** Pink noise (Paul Kellet's refined filter), roughly unit RMS. */
export class PinkNoise {
  private b0 = 0;
  private b1 = 0;
  private b2 = 0;
  private b3 = 0;
  private b4 = 0;
  private b5 = 0;
  private b6 = 0;

  constructor(private readonly rng: Rng) {}

  next() {
    const w = white(this.rng);
    this.b0 = 0.99886 * this.b0 + w * 0.0555179;
    this.b1 = 0.99332 * this.b1 + w * 0.0750759;
    this.b2 = 0.969 * this.b2 + w * 0.153852;
    this.b3 = 0.8665 * this.b3 + w * 0.3104856;
    this.b4 = 0.55 * this.b4 + w * 0.5329522;
    this.b5 = -0.7616 * this.b5 - w * 0.016898;
    const out = this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + w * 0.5362;
    this.b6 = w * 0.115926;
    return out * 0.11;
  }
}

/** Brown (red) noise from a leaky integrator, roughly unit RMS. */
export class BrownNoise {
  private last = 0;

  constructor(private readonly rng: Rng) {}

  next() {
    this.last = (this.last + 0.02 * white(this.rng)) / 1.02;
    return this.last * 3.5;
  }
}

type BiquadType = 'lowpass' | 'highpass' | 'bandpass';

/** RBJ cookbook biquad (transposed direct form II). */
export class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private z1 = 0;
  private z2 = 0;

  constructor(
    private readonly type: BiquadType,
    private readonly sampleRate: number,
    frequency: number,
    q = Math.SQRT1_2
  ) {
    this.set(frequency, q);
  }

  set(frequency: number, q = Math.SQRT1_2) {
    const nyquist = this.sampleRate / 2;
    const f = Math.min(Math.max(frequency, 10), nyquist * 0.95);
    const w0 = (2 * Math.PI * f) / this.sampleRate;
    const cos = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * Math.max(q, 0.05));
    const a0 = 1 + alpha;
    let b0: number;
    let b1: number;
    let b2: number;

    if (this.type === 'lowpass') {
      b0 = (1 - cos) / 2;
      b1 = 1 - cos;
      b2 = (1 - cos) / 2;
    } else if (this.type === 'highpass') {
      b0 = (1 + cos) / 2;
      b1 = -(1 + cos);
      b2 = (1 + cos) / 2;
    } else {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
    }

    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  process(x: number) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
}

/** One-pole low-pass, cheap enough for per-note tone shaping. */
export class OnePoleLowpass {
  private a: number;
  private z = 0;

  constructor(sampleRate: number, cutoff: number) {
    this.a = Math.exp((-2 * Math.PI * cutoff) / sampleRate);
  }

  process(x: number) {
    this.z = x * (1 - this.a) + this.z * this.a;
    return this.z;
  }
}

/**
 * A slowly wandering 0–1 control signal that repeats exactly every
 * `loopSeconds`, so modulation never jumps at the loop point. Values are
 * precomputed at a control rate of one point per 16 samples.
 */
export class LoopingModulator {
  private static readonly STEP = 16;
  private readonly table: Float32Array;

  constructor(rng: Rng, sampleRate: number, periodSeconds: number, loopSeconds: number) {
    const knotCount = Math.max(2, Math.round(loopSeconds / periodSeconds));
    const knots = new Float32Array(knotCount);
    for (let i = 0; i < knotCount; i++) {
      knots[i] = rng();
    }

    const loopSamples = Math.round(loopSeconds * sampleRate);
    const tableLength = Math.max(2, Math.ceil(loopSamples / LoopingModulator.STEP));
    this.table = new Float32Array(tableLength);
    for (let i = 0; i < tableLength; i++) {
      const position = (i / tableLength) * knotCount;
      const index = Math.floor(position);
      const frac = position - index;
      const a = knots[index % knotCount];
      const b = knots[(index + 1) % knotCount];
      this.table[i] = a + (b - a) * ((1 - Math.cos(frac * Math.PI)) / 2);
    }
  }

  at(sampleIndex: number) {
    const position = sampleIndex / LoopingModulator.STEP;
    const index = Math.floor(position);
    const frac = position - index;
    const length = this.table.length;
    const a = this.table[index % length];
    const b = this.table[(index + 1) % length];
    return a + (b - a) * frac;
  }
}

/** Equal-power stereo pan, `pan` in -1 (left) … 1 (right). */
export function panGains(pan: number): [number, number] {
  const angle = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  return [Math.cos(angle), Math.sin(angle)];
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function midiToFrequency(note: number) {
  return 440 * Math.pow(2, (note - 69) / 12);
}
