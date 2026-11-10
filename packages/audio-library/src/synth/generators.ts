import {
  Biquad,
  BrownNoise,
  LoopingModulator,
  OnePoleLowpass,
  PinkNoise,
  midiToFrequency,
  panGains,
  range,
  smoothstep,
  white,
  type Rng
} from './dsp';
import { addEvent, forEachBedChannel, type SynthContext, type SynthSpec } from './render';

const TWO_PI = Math.PI * 2;

// --- shared building blocks -------------------------------------------------

/** A pure tone with a sin² envelope and optional second harmonic. */
function addTone(
  ctx: SynthContext,
  start: number,
  duration: number,
  pan: number,
  amplitude: number,
  frequencyAt: (seconds: number) => number,
  secondHarmonic = 0.12
) {
  const { sampleRate } = ctx;
  let phase = 0;
  addEvent(ctx, start, duration, pan, (_i, t) => {
    phase += (TWO_PI * frequencyAt(t)) / sampleRate;
    const envelope = Math.sin((Math.PI * t) / duration) ** 2;
    return amplitude * envelope * (Math.sin(phase) + secondHarmonic * Math.sin(2 * phase));
  });
}

/** A short decaying burst of band-passed noise: drops, clicks, crackles. */
function addNoiseBurst(
  ctx: SynthContext,
  rng: Rng,
  start: number,
  options: { duration: number; decay: number; frequency: number; q: number; amplitude: number; pan: number }
) {
  const filter = new Biquad('bandpass', ctx.sampleRate, options.frequency, options.q);
  addEvent(ctx, start, options.duration, options.pan, (_i, t) => {
    return filter.process(white(rng)) * Math.exp(-t / options.decay) * options.amplitude;
  });
}

/** A decaying sine "body": the thump of a key or a train wheel. */
function addThump(
  ctx: SynthContext,
  start: number,
  options: { frequency: number; decay: number; amplitude: number; pan: number }
) {
  const { sampleRate } = ctx;
  let phase = 0;
  addEvent(ctx, start, options.decay * 6, options.pan, (_i, t) => {
    phase += (TWO_PI * options.frequency) / sampleRate;
    const attack = Math.min(t / 0.001, 1);
    return Math.sin(phase) * Math.exp(-t / options.decay) * attack * options.amplitude;
  });
}

// --- sounds -----------------------------------------------------------------

const brownNoise: SynthSpec = {
  loopSeconds: 12,
  crossfadeSeconds: 3,
  targetRms: 0.14,
  render(ctx) {
    forEachBedChannel(ctx, 'bed', (out, rng) => {
      const brown = new BrownNoise(rng);
      const highpass = new Biquad('highpass', ctx.sampleRate, 25);
      for (let i = 0; i < ctx.bedLength; i++) {
        out[i] += highpass.process(brown.next());
      }
    });
  }
};

const rainShower: SynthSpec = {
  loopSeconds: 20,
  crossfadeSeconds: 2,
  targetRms: 0.11,
  render(ctx) {
    const { sampleRate, loopSeconds } = ctx;

    forEachBedChannel(ctx, 'bed', (out, rng) => {
      const pink = new PinkNoise(rng);
      const highpass = new Biquad('highpass', sampleRate, 450);
      const lowpass = new Biquad('lowpass', sampleRate, 6500);
      const swell = new LoopingModulator(rng, sampleRate, 2.5, loopSeconds);
      for (let i = 0; i < ctx.bedLength; i++) {
        out[i] += lowpass.process(highpass.process(pink.next())) * (0.8 + 0.2 * swell.at(i));
      }
    });

    const rng = ctx.channelRng(0, 'drops');
    const dropCount = Math.round(loopSeconds * 90);
    for (let k = 0; k < dropCount; k++) {
      const decay = range(rng, 0.0004, 0.0015);
      addNoiseBurst(ctx, rng, rng() * loopSeconds, {
        duration: decay * 6,
        decay,
        frequency: range(rng, 1800, 6000),
        q: 1.2,
        amplitude: (0.05 + 0.4 * rng() ** 3) * 1.6,
        pan: range(rng, -0.8, 0.8)
      });
    }

    // A few bigger drops that "plink" off a surface.
    const plinkCount = Math.round(loopSeconds * 2);
    for (let k = 0; k < plinkCount; k++) {
      const base = range(rng, 2000, 4500);
      addTone(
        ctx,
        rng() * loopSeconds,
        0.04,
        range(rng, -0.7, 0.7),
        range(rng, 0.03, 0.08),
        (t) => base * (1 - 0.15 * Math.min(t / 0.02, 1)),
        0
      );
    }
  }
};

const distantThunder: SynthSpec = {
  loopSeconds: 30,
  crossfadeSeconds: 3,
  targetRms: 0.1,
  render(ctx) {
    const { sampleRate, loopSeconds } = ctx;

    forEachBedChannel(ctx, 'bed', (out, rng) => {
      const brown = new BrownNoise(rng);
      const pink = new PinkNoise(rng);
      const rumble = new Biquad('lowpass', sampleRate, 250);
      const hissLow = new Biquad('highpass', sampleRate, 900);
      const hissHigh = new Biquad('lowpass', sampleRate, 3500);
      for (let i = 0; i < ctx.bedLength; i++) {
        out[i] += rumble.process(brown.next()) * 0.35 + hissHigh.process(hissLow.process(pink.next())) * 0.06;
      }
    });

    const rng = ctx.channelRng(0, 'rumbles');
    const segment = loopSeconds / 3;
    for (let k = 0; k < 3; k++) {
      const start = k * segment + range(rng, 0.5, segment - 2);
      const duration = range(rng, 7, 10);
      const attack = range(rng, 0.15, 0.9);
      const decay = range(rng, 1.8, 3);
      const amplitude = range(rng, 0.9, 1.3);
      const brown = new BrownNoise(rng);
      const lowpass = new Biquad('lowpass', sampleRate, range(rng, 120, 300));
      const flutter = new LoopingModulator(rng, sampleRate, 0.12, duration);
      const crack = rng() < 0.5;
      const crackFilter = new Biquad('lowpass', sampleRate, 1200);

      addEvent(ctx, start, duration, range(rng, -0.5, 0.5), (i, t) => {
        const envelope = t < attack ? (t / attack) ** 2 : Math.exp(-(t - attack) / decay);
        const release = Math.min((duration - t) / 0.5, 1);
        let value = lowpass.process(brown.next()) * envelope * (0.55 + 0.45 * flutter.at(i)) * 2.5;
        if (crack && t < 0.8) {
          value += crackFilter.process(white(rng)) * Math.exp(-t / 0.25) * 0.4;
        }
        return value * amplitude * release;
      });
    }
  }
};

/** Wave envelope over one wave cycle: swell, crest, then wash back out. */
function waveShape(phase: number, crest: number) {
  if (phase < crest) {
    return Math.sin((Math.PI / 2) * (phase / crest)) ** 2;
  }
  return ((1 + Math.cos((Math.PI * (phase - crest)) / (1 - crest))) / 2) ** 1.6;
}

const oceanTide: SynthSpec = {
  loopSeconds: 24,
  crossfadeSeconds: 3,
  targetRms: 0.12,
  render(ctx) {
    const { sampleRate } = ctx;
    const wavePeriod = 8;
    const waveCount = Math.round(ctx.loopSeconds / wavePeriod);
    const amplitudes = Array.from({ length: waveCount }, () => range(ctx.rng, 0.7, 1));
    const crests = Array.from({ length: waveCount }, () => range(ctx.rng, 0.55, 0.7));

    forEachBedChannel(ctx, 'bed', (out, rng, channel) => {
      const pink = new PinkNoise(rng);
      const brown = new BrownNoise(rng);
      const lowpass = new Biquad('lowpass', sampleRate, 800, 0.6);
      // The right channel lags slightly, so waves seem to sweep across.
      const offset = channel === 1 ? 0.25 : 0;
      for (let i = 0; i < ctx.bedLength; i++) {
        const t = i / sampleRate + offset;
        const wave = Math.floor(t / wavePeriod) % waveCount;
        const phase = (t % wavePeriod) / wavePeriod;
        const envelope = 0.18 + 0.82 * amplitudes[wave] * waveShape(phase, crests[wave]);
        if ((i & 31) === 0) {
          lowpass.set(250 + 2600 * envelope * envelope, 0.6);
        }
        out[i] += lowpass.process(pink.next() * 0.7 + brown.next() * 0.5) * envelope;
      }
    });
  }
};

const airyWind: SynthSpec = {
  loopSeconds: 30,
  crossfadeSeconds: 3,
  targetRms: 0.11,
  render(ctx) {
    const { sampleRate, loopSeconds } = ctx;
    forEachBedChannel(ctx, 'bed', (out, rng) => {
      const pink = new PinkNoise(rng);
      const body = new Biquad('bandpass', sampleRate, 500, 0.9);
      const whistle = new Biquad('bandpass', sampleRate, 1500, 10);
      const sweep = new LoopingModulator(rng, sampleRate, 3.5, loopSeconds);
      const gusts = new LoopingModulator(rng, sampleRate, 4.5, loopSeconds);
      const whistleSweep = new LoopingModulator(rng, sampleRate, 2.5, loopSeconds);
      for (let i = 0; i < ctx.bedLength; i++) {
        if ((i & 31) === 0) {
          body.set(220 + 900 * sweep.at(i), 0.9);
          whistle.set(900 + 1400 * whistleSweep.at(i), 10);
        }
        const gust = gusts.at(i);
        out[i] +=
          body.process(pink.next()) * (0.25 + 0.75 * gust ** 1.5) * 2.2 +
          whistle.process(white(rng)) * 0.5 * gust ** 3;
      }
    });
  }
};

type BirdSpecies = 'tweet' | 'warble' | 'call' | 'trill';

function addBirdPhrase(
  ctx: SynthContext,
  rng: Rng,
  start: number,
  bird: { species: BirdSpecies; pan: number; pitch: number },
  amplitude: number
): number {
  const { pitch, pan } = bird;

  if (bird.species === 'tweet') {
    let t = start;
    const notes = Math.floor(range(rng, 3, 7));
    for (let n = 0; n < notes; n++) {
      const duration = range(rng, 0.05, 0.1);
      const base = pitch * range(rng, 0.95, 1.05);
      addTone(ctx, t, duration, pan, amplitude, (s) => base * (1 + 0.25 * (s / duration)));
      t += duration + range(rng, 0.04, 0.07);
    }
    return t - start;
  }

  if (bird.species === 'warble') {
    const duration = range(rng, 0.4, 0.8);
    const vibrato = range(rng, 22, 32);
    const depth = range(rng, 250, 450);
    const glide = range(rng, -200, 200);
    addTone(ctx, start, duration, pan, amplitude * 0.8, (s) => {
      return pitch + glide * (s / duration) + depth * Math.sin(TWO_PI * vibrato * s);
    });
    return duration;
  }

  if (bird.species === 'call') {
    // Two clear descending notes: "fee-bee".
    addTone(ctx, start, 0.25, pan, amplitude, (s) => pitch * (1 - 0.03 * (s / 0.25)));
    addTone(ctx, start + 0.33, 0.3, pan, amplitude * 0.9, (s) => pitch * 0.84 * (1 - 0.03 * (s / 0.3)));
    return 0.63;
  }

  const notes = Math.floor(range(rng, 8, 15));
  for (let n = 0; n < notes; n++) {
    addTone(ctx, start + n * 0.04, 0.025, pan, amplitude * 0.7, () => pitch * 1.3, 0.05);
  }
  return notes * 0.04;
}

const forestBirds: SynthSpec = {
  loopSeconds: 24,
  crossfadeSeconds: 3,
  targetRms: 0.06,
  render(ctx) {
    const { sampleRate, loopSeconds } = ctx;

    forEachBedChannel(ctx, 'leaves', (out, rng) => {
      const pink = new PinkNoise(rng);
      const filter = new Biquad('bandpass', sampleRate, 600, 0.5);
      const rustle = new LoopingModulator(rng, sampleRate, 3, loopSeconds);
      for (let i = 0; i < ctx.bedLength; i++) {
        out[i] += filter.process(pink.next()) * (0.5 + 0.5 * rustle.at(i)) * 0.15;
      }
    });

    const rng = ctx.channelRng(0, 'birds');
    const species: BirdSpecies[] = ['tweet', 'warble', 'call', 'trill'];
    const birds = species.map((kind) => ({
      species: kind,
      pan: range(rng, -0.85, 0.85),
      pitch: range(rng, 2800, 4200)
    }));

    let t = range(rng, 0, 0.6);
    while (t < loopSeconds) {
      const bird = birds[Math.floor(rng() * birds.length)];
      const length = addBirdPhrase(ctx, rng, t, bird, range(rng, 0.25, 0.9));
      t += length + range(rng, 0.4, 2.2);
    }
  }
};

const cityCafe: SynthSpec = {
  loopSeconds: 24,
  crossfadeSeconds: 3,
  targetRms: 0.1,
  render(ctx) {
    const { sampleRate, loopSeconds } = ctx;

    // Murmur: several "voices" of band-passed noise, each shaped by a
    // syllable-rate envelope and gated into phrases.
    forEachBedChannel(ctx, 'murmur', (out, rng) => {
      const voices = Array.from({ length: 4 }, () => ({
        filter: new Biquad('bandpass', sampleRate, 700, 1.4),
        center: range(rng, 450, 1100),
        syllables: new LoopingModulator(rng, sampleRate, range(rng, 0.16, 0.24), loopSeconds),
        phrases: new LoopingModulator(rng, sampleRate, range(rng, 1.6, 2.6), loopSeconds),
        formant: new LoopingModulator(rng, sampleRate, 0.3, loopSeconds),
        gain: range(rng, 0.6, 1)
      }));
      const room = new BrownNoise(rng);
      const roomFilter = new Biquad('lowpass', sampleRate, 400);
      const muffle = new Biquad('lowpass', sampleRate, 2200);

      const levels = new Float32Array(voices.length);
      for (let i = 0; i < ctx.bedLength; i++) {
        const control = (i & 15) === 0;
        let sum = 0;
        for (let v = 0; v < voices.length; v++) {
          const voice = voices[v];
          if (control) {
            if ((i & 31) === 0) {
              voice.filter.set(voice.center * (0.75 + 0.5 * voice.formant.at(i)), 1.4);
            }
            const syllable = voice.syllables.at(i);
            levels[v] = syllable * syllable * smoothstep(0.35, 0.65, voice.phrases.at(i)) * voice.gain;
          }
          sum += voice.filter.process(white(rng)) * levels[v];
        }
        out[i] += muffle.process(sum) * 1.2 + roomFilter.process(room.next()) * 0.12;
      }
    });

    // Cups and spoons.
    const rng = ctx.channelRng(0, 'clinks');
    const ratios = [1, 2.76, 5.4, 8.9];
    const weights = [1, 0.5, 0.25, 0.1];
    for (let k = 0; k < 7; k++) {
      const start = rng() * loopSeconds;
      const base = range(rng, 1900, 3200);
      const decay = range(rng, 0.18, 0.45);
      const amplitude = range(rng, 0.05, 0.12);
      const pan = range(rng, -0.7, 0.7);
      const strikes = rng() < 0.4 ? [0, 0.05] : [0];
      for (const offset of strikes) {
        ratios.forEach((ratio, index) => {
          let phase = 0;
          const partialDecay = decay / (1 + index);
          addEvent(ctx, start + offset, partialDecay * 6, pan, (_i, t) => {
            phase += (TWO_PI * base * ratio) / sampleRate;
            return Math.sin(phase) * Math.exp(-t / partialDecay) * weights[index] * amplitude;
          });
        });
      }
    }
  }
};

const midnightTrain: SynthSpec = {
  // 12 cycles of the wheel rhythm (1.6 s each), so the beat loops exactly.
  loopSeconds: 19.2,
  crossfadeSeconds: 2,
  targetRms: 0.12,
  render(ctx) {
    const { sampleRate, loopSeconds } = ctx;

    forEachBedChannel(ctx, 'rumble', (out, rng) => {
      const brown = new BrownNoise(rng);
      const pink = new PinkNoise(rng);
      const low = new Biquad('lowpass', sampleRate, 160);
      const mid = new Biquad('bandpass', sampleRate, 380, 0.8);
      const air = new Biquad('highpass', sampleRate, 2500);
      const sway = new LoopingModulator(rng, sampleRate, 2.4, loopSeconds);
      for (let i = 0; i < ctx.bedLength; i++) {
        const noise = pink.next();
        out[i] +=
          low.process(brown.next()) * 0.9 * (0.85 + 0.15 * sway.at(i)) +
          mid.process(noise) * 0.25 +
          air.process(noise) * 0.02;
      }
    });

    const rng = ctx.channelRng(0, 'clacks');
    const cycle = 1.6;
    const cycles = Math.round(loopSeconds / cycle);
    const hits: [number, number, number][] = [
      [0, 1, -0.15],
      [0.14, 0.85, -0.15],
      [0.8, 0.55, 0.15],
      [0.94, 0.5, 0.15]
    ];
    for (let k = 0; k < cycles; k++) {
      for (const [offset, weight, pan] of hits) {
        const start = k * cycle + offset + range(rng, -0.008, 0.008);
        const amplitude = weight * range(rng, 0.9, 1.1);
        const filter = new Biquad('lowpass', sampleRate, 1100, 0.8);
        addEvent(ctx, start, 0.15, pan, (_i, t) => {
          const attack = Math.min(t / 0.001, 1);
          return filter.process(white(rng)) * Math.exp(-t / 0.022) * attack * amplitude * 0.9;
        });
        addThump(ctx, start, { frequency: 60, decay: 0.05, amplitude: amplitude * 0.8, pan });
      }
    }
  }
};

const cityHum: SynthSpec = {
  loopSeconds: 30,
  crossfadeSeconds: 3,
  targetRms: 0.12,
  render(ctx) {
    const { sampleRate, loopSeconds } = ctx;

    forEachBedChannel(ctx, 'hum', (out, rng) => {
      const brown = new BrownNoise(rng);
      const pink = new PinkNoise(rng);
      const low = new Biquad('lowpass', sampleRate, 200);
      const drone = new Biquad('bandpass', sampleRate, 140, 1);
      const distant = new Biquad('bandpass', sampleRate, 900, 0.6);
      const activity = new LoopingModulator(rng, sampleRate, 5, loopSeconds);
      for (let i = 0; i < ctx.bedLength; i++) {
        const noise = pink.next();
        out[i] +=
          low.process(brown.next()) +
          drone.process(noise) * 0.3 +
          distant.process(noise) * 0.05 * (0.5 + activity.at(i));
      }
    });

    // Cars passing in the distance, sweeping from one side to the other.
    const rng = ctx.channelRng(0, 'traffic');
    for (let k = 0; k < 6; k++) {
      const start = rng() * loopSeconds;
      const duration = range(rng, 4, 7);
      const center = range(rng, 500, 1000);
      const amplitude = range(rng, 0.35, 0.7);
      const direction = rng() < 0.5 ? 1 : -1;
      const pink = new PinkNoise(rng);
      const filter = new Biquad('bandpass', sampleRate, center, 0.8);
      // Each car is panned as a whole; split it into slices so it can travel.
      const slices = 8;
      const slice = duration / slices;
      for (let s = 0; s < slices; s++) {
        const progressStart = s / slices;
        const pan = direction * (progressStart * 1.8 - 0.9);
        addEvent(ctx, start + s * slice, slice, pan, (i, t) => {
          const progress = progressStart + t / duration;
          if ((i & 31) === 0) {
            filter.set(center * (1.1 - 0.2 * progress), 0.8);
          }
          return filter.process(pink.next()) * Math.sin(Math.PI * progress) ** 2 * amplitude * 2;
        });
      }
    }
  }
};

const cozyFireplace: SynthSpec = {
  loopSeconds: 24,
  crossfadeSeconds: 3,
  targetRms: 0.1,
  render(ctx) {
    const { sampleRate, loopSeconds } = ctx;

    forEachBedChannel(ctx, 'roar', (out, rng) => {
      const brown = new BrownNoise(rng);
      const pink = new PinkNoise(rng);
      const low = new Biquad('lowpass', sampleRate, 450);
      const hiss = new Biquad('bandpass', sampleRate, 1800, 0.7);
      const flicker = new LoopingModulator(rng, sampleRate, 1.2, loopSeconds);
      for (let i = 0; i < ctx.bedLength; i++) {
        out[i] += low.process(brown.next()) * (0.65 + 0.35 * flicker.at(i)) * 0.9 + hiss.process(pink.next()) * 0.04;
      }
    });

    const rng = ctx.channelRng(0, 'crackles');
    const crackleCount = Math.round(loopSeconds * 22);
    for (let k = 0; k < crackleCount; k++) {
      const duration = range(rng, 0.0008, 0.006);
      const decay = duration / 3;
      const amplitude = 0.03 + 0.35 * rng() ** 5;
      let previous = 0;
      addEvent(ctx, rng() * loopSeconds, duration, range(rng, -0.6, 0.6), (_i, t) => {
        // First difference of white noise: a bright, sharp click.
        const value = white(rng);
        const click = value - previous;
        previous = value;
        return click * Math.exp(-t / decay) * amplitude;
      });
    }

    const popCount = Math.round(loopSeconds * 0.7);
    for (let k = 0; k < popCount; k++) {
      const start = rng() * loopSeconds;
      const pan = range(rng, -0.5, 0.5);
      addNoiseBurst(ctx, rng, start, {
        duration: 0.06,
        decay: 0.008,
        frequency: range(rng, 700, 2200),
        q: 2.5,
        amplitude: range(rng, 0.5, 1) * 2,
        pan
      });
      const embers = Math.floor(range(rng, 3, 9));
      for (let e = 0; e < embers; e++) {
        addNoiseBurst(ctx, rng, start + range(rng, 0.02, 0.2), {
          duration: 0.004,
          decay: 0.0008,
          frequency: range(rng, 2500, 5000),
          q: 1,
          amplitude: range(rng, 0.2, 0.6),
          pan: pan + range(rng, -0.1, 0.1)
        });
      }
    }
  }
};

function addKeystroke(ctx: SynthContext, rng: Rng, start: number, amplitude: number, isSpace: boolean) {
  const pan = range(rng, -0.2, 0.2);
  addNoiseBurst(ctx, rng, start, {
    duration: 0.008,
    decay: 0.0012,
    frequency: range(rng, 2500, 4200),
    q: 1.4,
    amplitude: amplitude * 1.4,
    pan
  });
  addThump(ctx, start, {
    frequency: isSpace ? 120 : range(rng, 170, 260),
    decay: isSpace ? 0.02 : 0.012,
    amplitude: amplitude * (isSpace ? 0.55 : 0.45),
    pan
  });

  // The key coming back up.
  const release = start + range(rng, 0.06, 0.1);
  addNoiseBurst(ctx, rng, release, {
    duration: 0.006,
    decay: 0.001,
    frequency: range(rng, 3500, 5000),
    q: 1.4,
    amplitude: amplitude * 0.6,
    pan
  });
  addThump(ctx, release, { frequency: range(rng, 220, 320), decay: 0.008, amplitude: amplitude * 0.15, pan });
}

const keyboardTyping: SynthSpec = {
  loopSeconds: 20,
  crossfadeSeconds: 2,
  targetRms: 0.06,
  render(ctx) {
    const { sampleRate, loopSeconds } = ctx;

    forEachBedChannel(ctx, 'room', (out, rng) => {
      const brown = new BrownNoise(rng);
      const filter = new Biquad('lowpass', sampleRate, 300);
      for (let i = 0; i < ctx.bedLength; i++) {
        out[i] += filter.process(brown.next()) * 0.03;
      }
    });

    const rng = ctx.channelRng(0, 'keys');
    let t = 0.3;
    let wordsUntilPause = Math.floor(range(rng, 6, 13));
    while (t < loopSeconds - 0.5) {
      const keys = Math.floor(range(rng, 2, 10));
      for (let k = 0; k < keys && t < loopSeconds - 0.5; k++) {
        addKeystroke(ctx, rng, t, range(rng, 0.6, 1), false);
        t += range(rng, 0.07, 0.16);
      }
      addKeystroke(ctx, rng, t, range(rng, 0.7, 1), true);
      t += range(rng, 0.08, 0.3);
      wordsUntilPause -= 1;
      if (wordsUntilPause <= 0) {
        t += range(rng, 0.8, 2.5);
        wordsUntilPause = Math.floor(range(rng, 6, 13));
      }
    }
  }
};

const SINE_TABLE_SIZE = 4096;
const SINE_TABLE = (() => {
  const table = new Float32Array(SINE_TABLE_SIZE + 1);
  for (let i = 0; i <= SINE_TABLE_SIZE; i++) {
    table[i] = Math.sin((i / SINE_TABLE_SIZE) * TWO_PI);
  }
  return table;
})();

/** Gain of a one-pole low-pass at `frequency`: a cheap stand-in for filtering a pure partial. */
function onePoleGain(frequency: number, cutoff: number) {
  return 1 / Math.sqrt(1 + (frequency / cutoff) ** 2);
}

function addPianoNote(
  ctx: SynthContext,
  rng: Rng,
  wow: Float32Array,
  start: number,
  midi: number,
  velocity: number,
  pan: number
) {
  const { sampleRate, loopLength, events, channelCount } = ctx;
  const f0 = midiToFrequency(midi);
  const baseDecay = Math.min(Math.max(2.4 * (220 / f0) ** 0.35, 0.6), 3.5);
  const duration = Math.min(baseDecay * 2.2, 4);
  const startSample = ((Math.round(start * sampleRate) % loopLength) + loopLength) % loopLength;
  const [left, right] = channelCount === 2 ? panGains(pan) : [1, 1];
  const attackSamples = 0.005 * sampleRate;
  const releaseSamples = 0.3 * sampleRate;
  const first = events[0];
  const second = channelCount === 2 ? events[1] : undefined;

  for (let k = 1; k <= 4; k++) {
    // Slight inharmonicity, like a real string.
    const frequency = k * f0 * Math.sqrt(1 + 0.0003 * k * k);
    if (frequency > sampleRate * 0.45) {
      break;
    }
    const decay = baseDecay / (1 + 0.5 * (k - 1));
    // Stop each partial once it has decayed by ~45 dB.
    const length = Math.round(Math.min(duration, decay * 5) * sampleRate);
    const decayPerSample = Math.exp(-1 / (decay * sampleRate));
    // Phase advances in sine-table units; the soft "felt" tone is a gentle
    // low-pass, which for a pure partial is just a fixed gain.
    const increment = (frequency / sampleRate) * SINE_TABLE_SIZE;
    let phase = rng() * SINE_TABLE_SIZE;
    let envelope = (velocity / k ** 1.4) * 0.5 * onePoleGain(frequency, 3000);
    let index = startSample;

    for (let i = 0; i < length; i++) {
      phase += increment * wow[index];
      if (phase >= SINE_TABLE_SIZE) {
        phase -= SINE_TABLE_SIZE;
      }
      const position = phase | 0;
      const sine = SINE_TABLE[position] + (SINE_TABLE[position + 1] - SINE_TABLE[position]) * (phase - position);

      envelope *= decayPerSample;
      let gain = envelope;
      if (i < attackSamples) {
        gain *= i / attackSamples;
      }
      const remaining = length - i;
      if (remaining < releaseSamples) {
        gain *= remaining / releaseSamples;
      }

      const value = sine * gain;
      first[index] += value * left;
      if (second) {
        second[index] += value * right;
      }
      index += 1;
      if (index >= loopLength) {
        index = 0;
      }
    }
  }

  // Felt hammer.
  const hammer = new OnePoleLowpass(sampleRate, 1500);
  addEvent(ctx, start, 0.03, pan, (_i, t) => hammer.process(white(rng)) * Math.exp(-t / 0.004) * velocity * 0.15);
}

const lofiPiano: SynthSpec = {
  // Four chords of four seconds each.
  loopSeconds: 16,
  crossfadeSeconds: 2,
  targetRms: 0.08,
  render(ctx) {
    const { sampleRate } = ctx;

    forEachBedChannel(ctx, 'vinyl', (out, rng) => {
      const pink = new PinkNoise(rng);
      const brown = new BrownNoise(rng);
      const hiss = new Biquad('highpass', sampleRate, 3000);
      const rumble = new Biquad('lowpass', sampleRate, 120);
      for (let i = 0; i < ctx.bedLength; i++) {
        out[i] += hiss.process(pink.next()) * 0.02 + rumble.process(brown.next()) * 0.02;
      }
    });

    const rng = ctx.channelRng(0, 'piano');
    // Tape "wow": a slow pitch wobble with a 2 s period, so it loops exactly.
    const wow = new Float32Array(ctx.loopLength);
    for (let i = 0; i < wow.length; i++) {
      wow[i] = 1 + 0.003 * Math.sin((TWO_PI * i) / (2 * sampleRate));
    }
    const chords = [
      { bass: 41, notes: [53, 57, 60, 64], melody: [72, 76, 81] }, // Fmaj7
      { bass: 40, notes: [52, 55, 59, 62], melody: [71, 74, 79] }, // Em7
      { bass: 38, notes: [50, 53, 57, 60], melody: [72, 74, 77] }, // Dm7
      { bass: 36, notes: [48, 52, 55, 59], melody: [71, 76, 79] } // Cmaj7
    ];

    chords.forEach((chord, index) => {
      const bar = index * 4;
      addPianoNote(ctx, rng, wow, bar, chord.bass, 0.8, -0.2);
      chord.notes.forEach((note, n) => {
        addPianoNote(ctx, rng, wow, bar + 0.02 + 0.035 * n, note, range(rng, 0.45, 0.6), -0.1 + 0.1 * n);
      });
      chord.notes.slice(1).forEach((note, n) => {
        addPianoNote(ctx, rng, wow, bar + 2 + 0.03 * n, note, range(rng, 0.25, 0.35), 0.1 * n);
      });
      for (const offset of [1, 3]) {
        const note = chord.melody[Math.floor(rng() * chord.melody.length)];
        addPianoNote(ctx, rng, wow, bar + offset + range(rng, 0, 0.5), note, range(rng, 0.3, 0.45), 0.25);
      }
    });

    // Vinyl crackle.
    const crackle = ctx.channelRng(0, 'crackle');
    for (let k = 0; k < ctx.loopSeconds * 4; k++) {
      const amplitude = range(crackle, 0.02, 0.12);
      addEvent(ctx, crackle() * ctx.loopSeconds, 0.003, range(crackle, -0.5, 0.5), (_i, t) => {
        return white(crackle) * Math.exp(-t / 0.0008) * amplitude;
      });
    }
  }
};

export const synthSpecs: Record<string, SynthSpec> = {
  'rain-shower': rainShower,
  'distant-thunder': distantThunder,
  'ocean-tide': oceanTide,
  'forest-birds': forestBirds,
  'city-cafe': cityCafe,
  'midnight-train': midnightTrain,
  'city-hum': cityHum,
  'cozy-fireplace': cozyFireplace,
  'keyboard-typing': keyboardTyping,
  'lofi-piano': lofiPiano,
  'brown-noise': brownNoise,
  'airy-wind': airyWind
};
