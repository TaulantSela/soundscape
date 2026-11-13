import type { MixState, SoundDefinition } from '@soundscape/audio-library';
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';

import { resolveSoundUri } from './sound-files';

type EngineState = Pick<MixState, 'gains' | 'masterVolume' | 'isPlaying'>;

/** One of the account's uploads: played from a downloaded copy of its file. */
export interface UploadedLayer {
  definition: SoundDefinition;
  /** A local file URI, downloading the file the first time. */
  resolveUri: () => Promise<string>;
}

/** Where an uploaded layer is, in seconds of its recording. */
export interface LayerPosition {
  position: number;
  duration: number;
}

interface EngineCallbacks {
  /** Playback was paused or resumed from outside the app (lock screen, headphones). */
  onExternalPlayingChange: (isPlaying: boolean) => void;
}

// After the app itself plays or pauses, status updates lag behind for a moment;
// mismatches inside this window are ours, not the lock screen's.
const OWN_COMMAND_GRACE_MS = 1500;

// Each time a looping layer wraps around it reports `playing: false` for a
// moment (expo-audio seeks back to the start and plays again). Only a state
// that still differs after this delay came from the lock screen or a headset.
const EXTERNAL_CHANGE_CONFIRM_MS = 600;

/**
 * Drives one looping player per active sound. Player properties are set
 * synchronously, so rapid slider changes can't race each other; only the
 * one-off preparation of a sound's file is asynchronous.
 */
export class MobileMixerEngine {
  private readonly definitions = new Map<string, SoundDefinition>();
  private readonly uploads = new Map<string, UploadedLayer>();
  private readonly players = new Map<string, AudioPlayer>();
  private readonly preparing = new Set<string>();
  /** Gains last applied, to spot an upload being switched on. */
  private appliedGains: Record<string, number> = {};
  private state: EngineState = { gains: {}, masterVolume: 0, isPlaying: false };
  private anchorId: string | null = null;
  private anchorSubscription: { remove(): void } | null = null;
  private lastOwnCommandAt = 0;
  private externalChangeTimer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;

  constructor(
    sounds: SoundDefinition[],
    private readonly callbacks: EngineCallbacks
  ) {
    sounds.forEach((sound) => this.definitions.set(sound.id, sound));
  }

  /**
   * Replace the account's uploads (empty when signed out). Removed ones stop
   * and release their players; new ones load when switched on.
   */
  setUploadedSounds(layers: UploadedLayer[]) {
    const next = new Set(layers.map((layer) => layer.definition.id));
    for (const id of this.uploads.keys()) {
      if (!next.has(id)) {
        this.uploads.delete(id);
        this.definitions.delete(id);
        if (this.anchorId === id) {
          this.releaseAnchor();
        }
        this.players.get(id)?.remove();
        this.players.delete(id);
      }
    }
    for (const layer of layers) {
      this.uploads.set(layer.definition.id, layer);
      this.definitions.set(layer.definition.id, layer.definition);
    }
    this.apply();
  }

  /** Where an uploaded layer is, or `undefined` while it's off or still loading. */
  readonly getPosition = (soundId: string): LayerPosition | undefined => {
    const player = this.players.get(soundId);
    if (!player || !this.uploads.has(soundId) || !player.isLoaded || !(player.duration > 0)) {
      return undefined;
    }
    return { position: Math.min(player.currentTime, player.duration), duration: player.duration };
  };

  /** Jump an uploaded layer to `seconds` into its recording. */
  readonly seek = (soundId: string, seconds: number) => {
    const player = this.players.get(soundId);
    if (!player || !this.uploads.has(soundId) || !(player.duration > 0)) {
      return;
    }
    player
      .seekTo(Math.min(Math.max(0, seconds), Math.max(0, player.duration - 0.25)))
      .catch(() => undefined);
  };

  update(state: EngineState) {
    if (state.isPlaying !== this.state.isPlaying) {
      this.lastOwnCommandAt = Date.now();
    }
    this.state = state;
    this.apply();
  }

  /** (Re)start after `dispose()`, e.g. when Fast Refresh re-runs effects. */
  activate() {
    this.disposed = false;
    this.apply();
  }

  dispose() {
    this.disposed = true;
    this.releaseAnchor();
    this.players.forEach((player) => player.remove());
    this.players.clear();
  }

  private apply() {
    if (this.disposed) {
      return;
    }
    const { gains, masterVolume, isPlaying } = this.state;

    this.definitions.forEach((_definition, soundId) => {
      const gain = gains[soundId] ?? 0;
      const player = this.players.get(soundId);
      const wasOn = (this.appliedGains[soundId] ?? 0) > 0;
      this.appliedGains[soundId] = player ? gain : 0;

      if (gain <= 0) {
        if (player?.playing) {
          player.pause();
        }
        return;
      }
      if (!player) {
        this.prepare(soundId);
        return;
      }

      // Uploads are recordings: switching one on plays it from the beginning.
      if (!wasOn && this.uploads.has(soundId)) {
        player.seekTo(0).catch(() => undefined);
      }
      // Master volume scales every layer; expo-audio has no shared bus.
      player.volume = gain * masterVolume;
      if (isPlaying && !player.playing) {
        player.play();
      } else if (!isPlaying && player.playing) {
        player.pause();
      }
    });

    this.updateAnchor();
  }

  private prepare(soundId: string) {
    const definition = this.definitions.get(soundId);
    if (!definition || this.preparing.has(soundId)) {
      return;
    }
    this.preparing.add(soundId);

    const upload = this.uploads.get(soundId);
    (upload ? upload.resolveUri() : resolveSoundUri(definition))
      .then((uri) => {
        // Signed out or deleted while downloading.
        if (upload && !this.uploads.has(soundId)) {
          return;
        }
        if (this.disposed || this.players.has(soundId)) {
          return;
        }
        const player = createAudioPlayer({ uri });
        player.loop = true;
        player.volume = 0;
        this.players.set(soundId, player);
        this.apply();
      })
      .catch((error: unknown) => console.warn(`Could not load sound "${soundId}"`, error))
      .finally(() => this.preparing.delete(soundId));
  }

  /**
   * One playing layer "owns" the lock-screen controls. On Android this also
   * runs the media playback service that keeps audio going while locked.
   */
  private updateAnchor() {
    const { gains, isPlaying } = this.state;
    const stillValid =
      this.anchorId !== null && (gains[this.anchorId] ?? 0) > 0 && this.players.has(this.anchorId);
    if (stillValid) {
      return;
    }

    this.releaseAnchor();
    const candidate = [...this.players.keys()].find((id) => (gains[id] ?? 0) > 0);
    if (!candidate || !isPlaying) {
      return;
    }

    const player = this.players.get(candidate);
    if (!player) {
      return;
    }
    this.anchorId = candidate;
    player.setActiveForLockScreen(true, { title: 'Soundscape Mixer', artist: 'Ambient mix' });
    this.anchorSubscription = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
      this.handleAnchorStatus(status);
    });
  }

  private releaseAnchor() {
    clearTimeout(this.externalChangeTimer);
    this.externalChangeTimer = undefined;
    this.anchorSubscription?.remove();
    this.anchorSubscription = null;
    if (this.anchorId) {
      this.players.get(this.anchorId)?.clearLockScreenControls();
    }
    this.anchorId = null;
  }

  private handleAnchorStatus(status: AudioStatus) {
    // A check is already pending. Don't push it back: a playing player sends
    // a status every 500 ms, so a resume would never get confirmed.
    if (!status.isLoaded || status.playing === this.state.isPlaying || this.externalChangeTimer) {
      return;
    }
    // Re-check once the player has settled instead of trusting this update:
    // a loop restart looks like a pause for a moment.
    this.externalChangeTimer = setTimeout(() => {
      this.externalChangeTimer = undefined;
      this.confirmExternalChange();
    }, EXTERNAL_CHANGE_CONFIRM_MS);
  }

  private confirmExternalChange() {
    const anchor = this.anchorId ? this.players.get(this.anchorId) : undefined;
    if (this.disposed || !anchor || Date.now() - this.lastOwnCommandAt < OWN_COMMAND_GRACE_MS) {
      return;
    }
    const playing = anchor.playing;
    if (playing !== this.state.isPlaying) {
      // The lock screen or a headset button paused/resumed the anchor layer:
      // follow it with the whole mix.
      this.lastOwnCommandAt = Date.now();
      this.callbacks.onExternalPlayingChange(playing);
    }
  }
}

export function useMixerAudio(
  sounds: SoundDefinition[],
  mix: EngineState,
  onExternalPlayingChange: (isPlaying: boolean) => void
) {
  const callbackRef = useRef(onExternalPlayingChange);
  callbackRef.current = onExternalPlayingChange;

  const [engine] = useState(
    () =>
      new MobileMixerEngine(sounds, {
        onExternalPlayingChange: (playing) => callbackRef.current(playing),
      })
  );

  useEffect(() => {
    engine.activate();
    void setAudioModeAsync({
      playsInSilentMode: true,
      // A sleep and focus app has to keep playing with the screen locked.
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch((error: unknown) => console.warn('Could not configure the audio session', error));
    return () => engine.dispose();
  }, [engine]);

  useEffect(() => {
    engine.update(mix);
  }, [engine, mix]);

  return engine;
}
