import type { SoundDefinition } from '@soundscape/audio-library';
import { getSoundUrl } from './audio';
import { renderSynthLoop } from './synth-client';

export interface EngineState {
  gains: Record<string, number>;
  masterVolume: number;
  isPlaying: boolean;
}

interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

const LAYER_FADE_SECONDS = 0.2;
const PAUSE_FADE_SECONDS = 0.12;

/**
 * Ramp from wherever the parameter is *now*. A bare `linearRampToValueAtTime`
 * starts from the previous automation event, which may be long in the past,
 * so the "fade" becomes a jump (and an audible click).
 */
function rampTo(param: AudioParam, value: number, context: BaseAudioContext, seconds: number) {
  const now = context.currentTime;
  const current = param.value;
  param.cancelScheduledValues(now);
  param.setValueAtTime(current, now);
  param.linearRampToValueAtTime(value, now + seconds);
}

type AudioContextConstructor = typeof AudioContext;

function getAudioContextClass(): AudioContextConstructor | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const legacy = (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  return window.AudioContext ?? legacy;
}

/**
 * Plays the mix with Web Audio. Each active layer is a looping buffer source
 * (gapless, unlike `<audio loop>`) feeding its own gain, then a master gain and
 * a gentle limiter. Pausing fades out and suspends the context.
 *
 * The AudioContext is created lazily by `unlock()`, which callers invoke
 * synchronously inside click and key handlers: Safari only lets a context start
 * from a user gesture.
 */
export class MixerAudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly definitions = new Map<string, SoundDefinition>();
  private readonly voices = new Map<string, Voice>();
  private readonly loading = new Set<string>();
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  /** Last gain applied per sound, so only changed layers are touched. */
  private applied: Record<string, number> = {};
  private state: EngineState = { gains: {}, masterVolume: 0, isPlaying: false };
  private suspendTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(sounds: SoundDefinition[]) {
    sounds.forEach((sound) => this.definitions.set(sound.id, sound));
  }

  /** Create or resume the audio context. Call from a user gesture. */
  unlock() {
    const context = this.ensureContext();
    if (context && context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }
    // If the gesture did not start playback, `sync` suspends again after the fade.
    this.sync();
  }

  setState(next: EngineState) {
    this.state = { gains: { ...next.gains }, masterVolume: next.masterVolume, isPlaying: next.isPlaying };
    if (!this.context && next.isPlaying) {
      // Playback started without a gesture we saw (e.g. the desktop tray).
      // Browsers that require a gesture keep the context suspended until one.
      this.ensureContext();
    }
    this.sync();
  }

  dispose() {
    clearTimeout(this.suspendTimer);
    this.voices.forEach((voice) => {
      try {
        voice.source.stop();
      } catch {
        // Already stopped.
      }
      voice.source.disconnect();
      voice.gain.disconnect();
    });
    this.voices.clear();
    this.loading.clear();
    this.applied = {};
    this.master?.disconnect();
    this.master = null;
    void this.context?.close().catch(() => undefined);
    this.context = null;
    // Decoded and rendered buffers are not tied to a context, so they stay cached.
  }

  private ensureContext() {
    if (this.context) {
      return this.context;
    }
    const AudioContextClass = getAudioContextClass();
    if (!AudioContextClass) {
      return null;
    }

    // iOS: play through the silent switch, like any other media app.
    const audioSession = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (audioSession) {
      try {
        audioSession.type = 'playback';
      } catch {
        // Not supported; harmless.
      }
    }

    const context = new AudioContextClass({ latencyHint: 'playback' });
    const master = context.createGain();
    master.gain.value = 0;

    // Several loud layers can sum past full scale; catch the peaks gently.
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;

    master.connect(limiter).connect(context.destination);
    this.context = context;
    this.master = master;
    this.applied = {};
    return context;
  }

  private sync() {
    const context = this.context;
    const master = this.master;
    if (!context || !master) {
      return;
    }
    this.syncLayers(context);
    this.syncPlayback(context, master);
  }

  private syncLayers(context: AudioContext) {
    const { gains } = this.state;

    for (const [soundId, target] of Object.entries(gains)) {
      if (this.applied[soundId] === target && (target === 0 || this.voices.has(soundId) || this.loading.has(soundId))) {
        continue;
      }
      this.applied[soundId] = target;
      if (target > 0) {
        this.startOrUpdateLayer(context, soundId, target);
      } else {
        this.stopLayer(context, soundId);
      }
    }

    // Layers for sounds that are no longer part of the mix at all.
    this.voices.forEach((_voice, soundId) => {
      if (!(soundId in gains)) {
        delete this.applied[soundId];
        this.stopLayer(context, soundId);
      }
    });
  }

  private syncPlayback(context: AudioContext, master: GainNode) {
    clearTimeout(this.suspendTimer);

    if (this.state.isPlaying) {
      if (context.state === 'suspended') {
        void context.resume().catch(() => undefined);
      }
      rampTo(master.gain, this.state.masterVolume, context, LAYER_FADE_SECONDS);
      return;
    }

    rampTo(master.gain, 0, context, PAUSE_FADE_SECONDS);
    // Also covers a context that `unlock()` is still resuming.
    if (context.state !== 'closed') {
      this.suspendTimer = setTimeout(() => {
        if (!this.state.isPlaying && this.context === context) {
          void context.suspend().catch(() => undefined);
        }
      }, PAUSE_FADE_SECONDS * 1000 + 50);
    }
  }

  private startOrUpdateLayer(context: AudioContext, soundId: string, target: number) {
    const voice = this.voices.get(soundId);
    if (voice) {
      rampTo(voice.gain.gain, target, context, LAYER_FADE_SECONDS);
      return;
    }
    if (this.loading.has(soundId) || !this.master) {
      return;
    }

    this.loading.add(soundId);
    void this.getBuffer(context, soundId).then((buffer) => {
      this.loading.delete(soundId);
      const master = this.master;
      // The mix may have moved on while the loop was rendering.
      const latest = this.state.gains[soundId] ?? 0;
      if (!buffer || this.context !== context || !master || latest <= 0 || this.voices.has(soundId)) {
        if (this.applied[soundId] === latest && latest > 0 && !this.voices.has(soundId)) {
          delete this.applied[soundId];
        }
        return;
      }

      const gain = context.createGain();
      gain.gain.value = 0;
      gain.connect(master);

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      // Start each loop at a random point so layers never line up the same way.
      source.start(context.currentTime, Math.random() * buffer.duration);

      this.voices.set(soundId, { source, gain });
      this.applied[soundId] = latest;
      rampTo(gain.gain, latest, context, LAYER_FADE_SECONDS);
    });
  }

  private stopLayer(context: AudioContext, soundId: string) {
    const voice = this.voices.get(soundId);
    if (!voice) {
      return;
    }
    this.voices.delete(soundId);
    rampTo(voice.gain.gain, 0, context, LAYER_FADE_SECONDS);
    voice.source.onended = () => {
      voice.source.disconnect();
      voice.gain.disconnect();
    };
    voice.source.stop(context.currentTime + LAYER_FADE_SECONDS + 0.05);
  }

  private getBuffer(context: AudioContext, soundId: string) {
    let buffer = this.buffers.get(soundId);
    if (!buffer) {
      buffer = this.loadBuffer(context, soundId).catch((error: unknown) => {
        console.warn(`Could not load sound "${soundId}"`, error);
        this.buffers.delete(soundId);
        return null;
      });
      this.buffers.set(soundId, buffer);
    }
    return buffer;
  }

  private async loadBuffer(context: AudioContext, soundId: string): Promise<AudioBuffer> {
    const definition = this.definitions.get(soundId);
    const url = definition ? getSoundUrl(definition) : undefined;

    if (url) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return context.decodeAudioData(await response.arrayBuffer());
    }

    const loop = await renderSynthLoop(soundId);
    const buffer = context.createBuffer(loop.channels.length, loop.channels[0].length, loop.sampleRate);
    loop.channels.forEach((channel, index) => buffer.copyToChannel(channel, index));
    return buffer;
  }
}
