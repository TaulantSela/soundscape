'use client';

import { useCallback } from 'react';
import {
  buildSharedMixPath,
  hasActiveSounds,
  type PresetDefinition,
  type SharedMix,
  type SoundDefinition
} from '@soundscape/audio-library';
import { toast } from 'sonner';
import { useMixerStore } from '@/store/mixer-store';
import { useMixerSession } from '@/hooks/use-mixer-session';
import { useMixerShortcuts } from '@/hooks/use-mixer-shortcuts';
import { useAudioEngine } from '@/hooks/use-audio-engine';
import { useDesktopBridge } from '@/hooks/use-desktop-bridge';
import { SoundGrid } from '@/components/mixer/sound-grid';
import { TransportBar } from '@/components/mixer/transport-bar';
import { PresetPanel } from '@/components/mixer/preset-panel';
import { ShareMixButton } from '@/components/mixer/share-button';
import { MixBanner } from '@/components/mixer/mix-banner';
import { getShareOrigin } from '@/lib/config';
import { shareLink } from '@/lib/share-link';

interface MixerAppProps {
  sounds: SoundDefinition[];
  presets: PresetDefinition[];
  /** A mix opened from a share link. */
  sharedMix?: SharedMix;
}

export function MixerApp({ sounds, presets, sharedMix }: MixerAppProps) {
  useMixerSession(sounds, presets, sharedMix);
  const engine = useAudioEngine(sounds);
  const unlock = useCallback(() => engine.unlock(), [engine]);
  useMixerShortcuts(sounds, unlock);

  const mix = useMixerStore((state) => state.mix);
  const hydrated = useMixerStore((state) => state.hydrated);
  const mode = useMixerStore((state) => state.mode);
  const activePresetId = useMixerStore((state) => state.activePresetId);
  const toggleSound = useMixerStore((state) => state.toggleSound);
  const setSoundVolume = useMixerStore((state) => state.setSoundVolume);
  const setMasterVolume = useMixerStore((state) => state.setMasterVolume);
  const setPlaying = useMixerStore((state) => state.setPlaying);
  const togglePlaying = useMixerStore((state) => state.togglePlaying);
  const applyPreset = useMixerStore((state) => state.applyPreset);
  const keepSharedMix = useMixerStore((state) => state.keepSharedMix);
  const serialize = useMixerStore((state) => state.serialize);

  const handleDesktopToggle = useCallback(() => {
    unlock();
    togglePlaying();
  }, [togglePlaying, unlock]);
  useDesktopBridge(handleDesktopToggle);

  const handleTogglePlay = useCallback(() => {
    unlock();
    setPlaying(!mix.isPlaying);
  }, [mix.isPlaying, setPlaying, unlock]);

  const handleShare = useCallback(async () => {
    const soundsToShare = serialize();
    if (soundsToShare.length === 0) {
      return;
    }
    const url = `${getShareOrigin()}${buildSharedMixPath({ sounds: soundsToShare, masterVolume: mix.masterVolume })}`;
    const outcome = await shareLink(url, 'My Soundscape mix');
    if (outcome === 'copied') {
      toast.success('Shareable link copied to clipboard');
    }
  }, [mix.masterVolume, serialize]);

  const handleKeepSharedMix = useCallback(() => {
    keepSharedMix();
    // The mix is now the visitor's own, so the address should be the mixer's.
    window.history.replaceState(null, '', '/');
    toast.success('Saved. This is now your mix.');
  }, [keepSharedMix]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-textMuted">
        Initialising mixer…
      </div>
    );
  }

  const hasSounds = hasActiveSounds(mix);

  return (
    <div className="space-y-6 pb-32">
      {mode === 'shared' ? (
        <MixBanner
          title={sharedMix?.name ? `You're listening to "${sharedMix.name}"` : "You're listening to a shared mix"}
          description="Press play to listen, tweak the layers, or keep it as your own mix."
          actionLabel="Keep this mix"
          onAction={handleKeepSharedMix}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-3xl border border-surfaceRaised bg-surface/80 p-6 backdrop-blur">
          <header className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-100">Soundscape Mixer</h1>
              <p className="text-sm text-textMuted">Blend ambient layers to craft your perfect focus or sleep mix.</p>
            </div>
            <div className="hidden text-right text-xs text-textMuted lg:block">
              <p>Spacebar — play/pause</p>
              <p>Digits 1-9 — toggle sounds</p>
            </div>
          </header>
          <SoundGrid
            sounds={sounds}
            volumes={mix.gains}
            onToggle={(id) => {
              unlock();
              toggleSound(id);
            }}
            onVolumeChange={(id, volume) => {
              unlock();
              setSoundVolume(id, volume);
            }}
          />
        </section>

        <PresetPanel
          presets={presets}
          activePresetId={activePresetId}
          onApply={(presetId) => {
            unlock();
            applyPreset(presetId);
          }}
        />
      </div>

      <TransportBar
        isPlaying={mix.isPlaying}
        canPlay={hasSounds}
        masterVolume={mix.masterVolume}
        onTogglePlay={handleTogglePlay}
        onMasterVolumeChange={setMasterVolume}
      >
        <ShareMixButton onShare={handleShare} disabled={!hasSounds} />
      </TransportBar>
    </div>
  );
}
