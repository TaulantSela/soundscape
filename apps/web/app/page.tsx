import { MixerApp } from '@/components/mixer/mixer-app';
import { builtInPresets, soundLibrary } from '@soundscape/audio-library';

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-screen-2xl px-4 pb-24 pt-10 md:px-8">
      <MixerApp sounds={soundLibrary} presets={builtInPresets} />
    </main>
  );
}
