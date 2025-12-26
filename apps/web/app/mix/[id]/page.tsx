import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { MixerApp } from '@/components/mixer/mixer-app';
import { builtInPresets, soundLibrary } from '@soundscape/audio-library';
import { apiClient } from '@/lib/api-client';

const fetchSharedMix = cache(async (id: string) => {
  try {
    return await apiClient.fetchMix(id);
  } catch (error) {
    console.error('Failed to fetch shared mix', error);
    return null;
  }
});

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const mix = await fetchSharedMix(params.id);
  if (!mix) {
    return {
      title: 'Shared mix not found'
    };
  }

  return {
    title: mix.name ? `${mix.name} · Soundscape Mix` : 'Shared mix · Soundscape',
    description: 'Listen to a shared ambient mix and add it to your library.'
  };
}

export default async function SharedMixPage({ params }: { params: { id: string } }) {
  const mix = await fetchSharedMix(params.id);

  if (!mix) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-4 pb-24 pt-10 md:px-8">
      <MixerApp
        sounds={soundLibrary}
        presets={builtInPresets}
        initialMix={{ sounds: mix.sounds, masterVolume: mix.masterVolume }}
        banner={{
          title: mix.name ? `You're listening to "${mix.name}"` : "You're listening to a shared mix",
          description: 'Play it immediately, tweak the layers, or save it once you sign in.',
          showSave: false
        }}
      />
    </main>
  );
}
