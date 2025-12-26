'use client';

import type { SoundDefinition } from '@soundscape/audio-library';
import { SoundCard } from './sound-card';

interface SoundGridProps {
  sounds: SoundDefinition[];
  volumes: Record<string, number>;
  onToggle: (soundId: string) => void;
  onVolumeChange: (soundId: string, volume: number) => void;
}

export function SoundGrid({ sounds, volumes, onToggle, onVolumeChange }: SoundGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {sounds.map((sound) => (
        <SoundCard
          key={sound.id}
          sound={sound}
          volume={volumes[sound.id] ?? 0}
          isActive={(volumes[sound.id] ?? 0) > 0}
          onToggle={() => onToggle(sound.id)}
          onVolumeChange={(value) => onVolumeChange(sound.id, value)}
        />
      ))}
    </div>
  );
}
