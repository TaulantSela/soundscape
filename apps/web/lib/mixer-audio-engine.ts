import { userSoundExtension, type SoundDefinition } from '@soundscape/audio-library';
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

const LOOP_CROSSFADE_SECONDS = 0.3;

/** How long an uploaded sound's decoded audio is kept after its layer goes off. */
const RELEASE_AFTER_MS = 30_000;

/**
 * Make an arbitrary recording loop without a click: the last moments are
 * faded (equal-power) into the first ones, and the returned loop end stops
 * short of them, so playback runs from the tail straight into the blended
 * head. It works in place because a long upload decodes to hundreds of MB,
 * and a shortened copy would briefly double that.
 */
function crossfadeLoop(buffer: AudioBuffer): number | undefined {
  const fade = Math.min(Math.floor(LOOP_CROSSFADE_SECONDS * buffer.sampleRate), Math.floor(buffer.length / 4));
  if (fade < 64) {
    return undefined;
  }
  const length = buffer.length - fade;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let i = 0; i < fade; i++) {
      const position = (i / fade) * (Math.PI / 2);
      samples[i] = samples[i] * Math.sin(position) + samples[length + i] * Math.cos(position);
    }
  }
  return length / buffer.sampleRate;
}

/**
 * Safari decodes AAC extremely slowly when it needn't resample: a nine-minute
 * 48 kHz M4A takes 30–45 s at 48 kHz but under half a second at 47,999 Hz, and
 * phones record AAC at the rate Safari plays at. So AAC is decoded 1 Hz below
 * the context's rate and its samples are copied into a buffer at that rate
 * (briefly holding both). They play 0.002% fast, far too little to hear, with
 * no second resampling: playing the 47,999 Hz buffer directly would resample,
 * and `playbackRate` (a 32-bit float) can't cancel that out exactly.
 */
async function decodeAac(context: AudioContext, bytes: ArrayBuffer) {
  const decoded = await new OfflineAudioContext(1, 1, context.sampleRate - 1).decodeAudioData(bytes);
  const buffer = context.createBuffer(decoded.numberOfChannels, decoded.length, context.sampleRate);
  for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
    buffer.copyToChannel(decoded.getChannelData(channel), channel);
  }
  return buffer;
}

export interface UploadedSound {
  definition: SoundDefinition;
  contentType: string;
  /** Downloads the file (through the account's authenticated API). */
  load: () => Promise<ArrayBuffer>;
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
  /** `loading` as an immutable snapshot, for `useSyncExternalStore`. */
  private loadingSnapshot: ReadonlySet<string> = new Set();
  private readonly loadingListeners = new Set<() => void>();
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  private readonly uploads = new Map<string, UploadedSound>();
  /**
   * Downloaded files of uploaded sounds. They outlive the decoded samples, so
   * switching a layer back on only decodes again: a compressed file is a
   * fraction of its samples' size, and the account quota bounds the total.
   */
  private readonly files = new Map<string, Promise<ArrayBuffer>>();
  /** Where a crossfaded upload's loop ends; the samples after it only feed the fade. */
  private readonly loopEnds = new WeakMap<AudioBuffer, number>();
  private readonly releaseTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Last gain applied per sound, so only changed layers are touched. */
  private applied: Record<string, number> = {};
  private state: EngineState = { gains: {}, masterVolume: 0, isPlaying: false };
  private suspendTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(sounds: SoundDefinition[]) {
    sounds.forEach((sound) => this.definitions.set(sound.id, sound));
  }

  /**
   * Replace the set of uploaded sounds. Removed ones are forgotten (their
   * layers stop once the mix drops them); new ones load when switched on.
   */
  setUploadedSounds(sounds: UploadedSound[]) {
    const next = new Set(sounds.map((sound) => sound.definition.id));
    for (const id of this.uploads.keys()) {
      if (!next.has(id)) {
        this.uploads.delete(id);
        this.definitions.delete(id);
        this.buffers.delete(id);
        this.files.delete(id);
        this.cancelRelease(id);
      }
    }
    for (const sound of sounds) {
      this.definitions.set(sound.definition.id, sound.definition);
      this.uploads.set(sound.definition.id, sound);
    }
    this.sync();
  }

  /** Sounds whose audio is downloading or decoding. */
  readonly getLoadingSnapshot = (): ReadonlySet<string> => this.loadingSnapshot;

  readonly subscribeLoading = (listener: () => void) => {
    this.loadingListeners.add(listener);
    return () => {
      this.loadingListeners.delete(listener);
    };
  };

  /** Create or resume the audio context. Call from a user gesture. */
  unlock() {
    const context = this.ensureContext();
    if (context && context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }
    // If the gesture did not start playback, this suspends again after the
    // fade. Layers wait for the `setState` the gesture causes: syncing them
    // now would use the mix from before the click, and could start downloading
    // an upload that the click is switching off.
    if (context && this.master) {
      this.syncPlayback(context, this.master);
    }
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
    this.releaseTimers.forEach((timer) => clearTimeout(timer));
    this.releaseTimers.clear();
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
    this.publishLoading();
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

    // iOS: play through the silent switch, like any other media app. This
    // also keeps the mix playing with the screen locked or another app in
    // front: without it Safari interrupts the context the moment the page is
    // hidden (verified on iOS 26.5).
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

    this.cancelRelease(soundId);
    this.loading.add(soundId);
    this.publishLoading();
    void this.getBuffer(context, soundId).then((buffer) => {
      this.loading.delete(soundId);
      this.publishLoading();
      const master = this.master;
      // The mix may have moved on while the loop was rendering.
      const latest = this.state.gains[soundId] ?? 0;
      if (!buffer || this.context !== context || !master || latest <= 0 || this.voices.has(soundId)) {
        if (this.applied[soundId] === latest && latest > 0 && !this.voices.has(soundId)) {
          delete this.applied[soundId];
        }
        if (!this.voices.has(soundId)) {
          this.scheduleRelease(soundId);
        }
        return;
      }

      const gain = context.createGain();
      gain.gain.value = 0;
      gain.connect(master);

      const loopEnd = this.loopEnds.get(buffer) ?? buffer.duration;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = 0;
      source.loopEnd = loopEnd;
      source.connect(gain);
      // Start each loop at a random point so layers never line up the same way.
      source.start(context.currentTime, Math.random() * loopEnd);

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
    this.scheduleRelease(soundId);
  }

  /**
   * Uploads can be ten minutes long, which decodes to over 200 MB, so their
   * samples are dropped once a layer stays off. Switching it back on after
   * that decodes the kept file again. Built-in loops are small and stay cached.
   */
  private scheduleRelease(soundId: string) {
    if (!this.uploads.has(soundId)) {
      return;
    }
    this.cancelRelease(soundId);
    this.releaseTimers.set(
      soundId,
      setTimeout(() => {
        this.releaseTimers.delete(soundId);
        if (!this.voices.has(soundId) && !this.loading.has(soundId)) {
          this.buffers.delete(soundId);
        }
      }, RELEASE_AFTER_MS)
    );
  }

  private cancelRelease(soundId: string) {
    clearTimeout(this.releaseTimers.get(soundId));
    this.releaseTimers.delete(soundId);
  }

  private publishLoading() {
    this.loadingSnapshot = new Set(this.loading);
    this.loadingListeners.forEach((listener) => listener());
  }

  private getFile(upload: UploadedSound) {
    const soundId = upload.definition.id;
    const cached = this.files.get(soundId);
    if (cached) {
      return cached;
    }
    const file = upload.load();
    this.files.set(soundId, file);
    file.catch(() => {
      if (this.files.get(soundId) === file) {
        this.files.delete(soundId);
      }
    });
    return file;
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
    const upload = this.uploads.get(soundId);
    if (upload) {
      // decodeAudioData detaches what it's given, so decode a copy.
      const bytes = (await this.getFile(upload)).slice(0);
      const extension = userSoundExtension(upload.contentType);
      const buffer =
        extension === 'm4a' || extension === 'aac'
          ? await decodeAac(context, bytes)
          : await context.decodeAudioData(bytes);
      const loopEnd = crossfadeLoop(buffer);
      if (loopEnd !== undefined) {
        this.loopEnds.set(buffer, loopEnd);
      }
      return buffer;
    }

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
