'use client';

import { type SoundDefinition } from '@soundscape/audio-library';
import { Slider } from '@/components/ui/slider';
import { cn, formatPercent } from '@/lib/utils';

interface SoundCardProps {
  sound: SoundDefinition;
  volume: number;
  isActive: boolean;
  /** Its audio is still downloading or decoding. */
  isLoading?: boolean;
  onToggle: () => void;
  onVolumeChange: (value: number) => void;
  /** Shown for the listener's own uploads. */
  onDelete?: () => void;
}

export function SoundCard({ sound, volume, isActive, isLoading = false, onToggle, onVolumeChange, onDelete }: SoundCardProps) {
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
        aria-busy={isLoading}
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
        {isLoading ? (
          <span className="animate-pulse text-sm text-textMuted">Loading…</span>
        ) : (
          <span className="text-sm text-textMuted capitalize">{sound.category === 'mine' ? 'Your upload' : sound.category}</span>
        )}
      </button>

      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${sound.name}`}
          className="absolute right-3 top-3 z-10 rounded-full px-2 py-1 text-xs text-textMuted transition-colors hover:bg-surface hover:text-rose-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Delete
        </button>
      ) : null}

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
