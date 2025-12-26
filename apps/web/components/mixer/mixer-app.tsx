'use client';

import { useCallback, useEffect, useMemo } from 'react';
import type {
  PresetDefinition,
  PresetSoundSetting,
  SoundDefinition
} from '@soundscape/audio-library';
import { buildAppUrl } from '@soundscape/config';
import { toast } from 'sonner';
import { useMixerStore } from '@/store/mixer-store';
import { useMixerHydration } from '@/hooks/use-mixer-hydration';
import { useMixerShortcuts } from '@/hooks/use-mixer-shortcuts';
import { useAudioEngine } from '@/hooks/use-audio-engine';
import { SoundGrid } from '@/components/mixer/sound-grid';
import { TransportBar } from '@/components/mixer/transport-bar';
import { PresetPanel } from '@/components/mixer/preset-panel';
import { ShareMixButton } from '@/components/mixer/share-button';
import { appConfig } from '@/lib/config';
import { apiClient } from '@/lib/api-client';
import { MixBanner } from '@/components/mixer/mix-banner';

interface MixerAppProps {
  sounds: SoundDefinition[];
  presets: PresetDefinition[];
  banner?: {
    title: string;
    description?: string;
    showSave?: boolean;
    onSave?: () => void;
  };
  initialMix?: {
    sounds: PresetSoundSetting[];
    masterVolume: number;
  };
}

export function MixerApp({ sounds, presets, banner, initialMix }: MixerAppProps) {
  useMixerHydration(sounds, presets);
  useMixerShortcuts(sounds);
  const { resume } = useAudioEngine(sounds);

  const mix = useMixerStore((state) => state.mix);
  const hydrated = useMixerStore((state) => state.hydrated);
  const toggleSound = useMixerStore((state) => state.toggleSound);
  const setSoundVolume = useMixerStore((state) => state.setSoundVolume);
  const setMasterVolume = useMixerStore((state) => state.setMasterVolume);
  const setPlaying = useMixerStore((state) => state.setPlaying);
  const applyPreset = useMixerStore((state) => state.applyPreset);
  const activePresetId = useMixerStore((state) => state.activePresetId);
  const serialize = useMixerStore((state) => state.serialize);
  const loadMixState = useMixerStore((state) => state.loadMix);

  const volumes = useMemo(() => mix.gains, [mix.gains]);

  useEffect(() => {
    if (!hydrated || !initialMix) {
      return;
    }
    loadMixState(initialMix);
  }, [hydrated, initialMix, loadMixState]);

  const handleTogglePlay = useCallback(async () => {
    if (!mix.isPlaying) {
      await resume();
    }
    setPlaying(!mix.isPlaying);
  }, [mix.isPlaying, resume, setPlaying]);

  const handleShare = useCallback(async () => {
    try {
      const payload = {
        sounds: serialize(),
        masterVolume: mix.masterVolume
      };
      const response = await apiClient.createMix(payload);
      const url = buildAppUrl(appConfig, `/mix/${response.id}`);
      await navigator.clipboard.writeText(url);
      toast.success('Shareable link copied to clipboard');
    } catch (error) {
      toast.error((error as Error).message ?? 'Unable to share mix right now');
    }
  }, [mix.masterVolume, serialize]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-textMuted">
        Initialising mixer…
      </div>
    );
  }

  const canShare = serialize().length > 0;

  return (
    <div className="space-y-6 pb-32">
      {banner ? (
        <MixBanner
          title={banner.title}
          description={banner.description}
          showSave={banner.showSave}
          onSave={banner.onSave}
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
            volumes={volumes}
            onToggle={(id) => {
              void resume();
              toggleSound(id);
            }}
            onVolumeChange={(id, volume) => setSoundVolume(id, volume)}
          />
        </section>

        <PresetPanel presets={presets} activePresetId={activePresetId} onApply={applyPreset} />
      </div>

      <TransportBar
        isPlaying={mix.isPlaying}
        masterVolume={mix.masterVolume}
        onTogglePlay={handleTogglePlay}
        onMasterVolumeChange={setMasterVolume}
      >
        <ShareMixButton onShare={handleShare} disabled={!canShare} />
      </TransportBar>
    </div>
  );
}
