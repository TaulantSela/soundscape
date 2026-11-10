import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { builtInPresets, decodeSharedMix, getSoundById, soundLibrary } from '@soundscape/audio-library';
import { MixerApp } from '@/components/mixer/mixer-app';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function describeMix(soundIds: string[]) {
  const names = soundIds.map((id) => getSoundById(id)?.name).filter((name): name is string => Boolean(name));
  if (names.length <= 1) {
    return names.join('');
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const mix = decodeSharedMix(await searchParams);
  if (!mix) {
    return { title: 'Shared mix not found · Soundscape' };
  }

  const title = mix.name ? `${mix.name} · Soundscape Mix` : 'Shared mix · Soundscape';
  const description = `An ambient mix of ${describeMix(mix.sounds.map((item) => item.soundId))}.`;
  return { title, description, openGraph: { title, description } };
}

export default async function SharedMixPage({ searchParams }: { searchParams: SearchParams }) {
  const mix = decodeSharedMix(await searchParams);
  if (!mix) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-4 pb-24 pt-10 md:px-8">
      <MixerApp sounds={soundLibrary} presets={builtInPresets} sharedMix={mix} />
    </main>
  );
}
