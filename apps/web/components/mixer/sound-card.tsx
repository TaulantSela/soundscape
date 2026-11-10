'use client';

import { type SoundDefinition } from '@soundscape/audio-library';
import { Slider } from '@/components/ui/slider';
import { cn, formatPercent } from '@/lib/utils';

interface SoundCardProps {
  sound: SoundDefinition;
  volume: number;
  isActive: boolean;
  onToggle: () => void;
  onVolumeChange: (value: number) => void;
}

export function SoundCard({ sound, volume, isActive, onToggle, onVolumeChange }: SoundCardProps) {
  return (
    <div
      className={cn(
        'group relative flex h-full flex-col justify-between rounded-3xl border border-transparent bg-surfaceRaised p-4 shadow-sm transition-all duration-200 ease-glide',
        isActive && 'border-accent/40 shadow-glow'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={isActive}
        aria-label={`${isActive ? 'Turn off' : 'Turn on'} ${sound.name}`}
        className={cn(
          'flex flex-1 flex-col items-start gap-2 text-left transition-transform duration-200 ease-glide',
          isActive ? 'scale-[1.02]' : 'opacity-90 group-hover:opacity-100'
        )}
      >
        <span className="text-3xl" aria-hidden>
          {sound.emoji ?? '🎧'}
        </span>
        <span className="text-lg font-semibold text-slate-100">{sound.name}</span>
        <span className="text-sm text-textMuted capitalize">{sound.category}</span>
      </button>

      <div className="mt-6 flex flex-col gap-2">
        <Slider
          aria-label={`${sound.name} volume`}
          value={Math.round(volume * 100)}
          onChange={(event) => onVolumeChange(Number.parseInt(event.target.value, 10) / 100)}
        />
        <span className="text-xs font-medium text-textMuted">{formatPercent(volume, 0)}</span>
      </div>

      <div
        className={cn(
          'pointer-events-none absolute inset-0 rounded-3xl bg-accent/10 opacity-0 transition-opacity duration-200 ease-glide',
          isActive && 'opacity-100'
        )}
      />
    </div>
  );
}
