'use client';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { formatPercent } from '@/lib/utils';

interface TransportBarProps {
  isPlaying: boolean;
  masterVolume: number;
  onTogglePlay: () => void;
  onMasterVolumeChange: (volume: number) => void;
  children?: React.ReactNode;
}

export function TransportBar({
  isPlaying,
  masterVolume,
  onTogglePlay,
  onMasterVolumeChange,
  children
}: TransportBarProps) {
  return (
    <div className="sticky bottom-4 z-40 rounded-3xl border border-surfaceRaised bg-surface/90 p-4 backdrop-blur">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button onClick={onTogglePlay} size="md">
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          {children ? <div className="flex items-center gap-2">{children}</div> : null}
        </div>
        <div className="flex w-full max-w-sm items-center gap-3 md:ml-auto">
          <span className="text-xs uppercase tracking-wide text-textMuted">Master</span>
          <Slider
            aria-label="Master volume"
            value={Math.round(masterVolume * 100)}
            onChange={(event) => onMasterVolumeChange(Number.parseInt(event.target.value, 10) / 100)}
          />
          <span className="text-sm font-medium text-slate-100">{formatPercent(masterVolume, 0)}</span>
        </div>
      </div>
    </div>
  );
}
