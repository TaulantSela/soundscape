'use client';

import { useEffect, useState } from 'react';
import type { LayerPosition } from '@/lib/mixer-audio-engine';

const SKIP_SECONDS = 15;
const REFRESH_MS = 250;

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

interface UploadTransportProps {
  soundId: string;
  name: string;
  getPosition: (soundId: string) => LayerPosition | undefined;
  onSeek: (soundId: string, seconds: number) => void;
}

const buttonClass =
  'rounded-full px-2 py-1 text-xs text-textMuted transition-colors hover:bg-surface hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

/** Where an uploaded layer is, with scrubbing and skipping. Shown while it's on. */
export function UploadTransport({ soundId, name, getPosition, onSeek }: UploadTransportProps) {
  const [now, setNow] = useState<LayerPosition | undefined>(undefined);

  useEffect(() => {
    const refresh = () => setNow(getPosition(soundId));
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [getPosition, soundId]);

  // Still downloading or decoding: the card says so.
  if (!now) {
    return null;
  }

  const seek = (seconds: number) => {
    onSeek(soundId, seconds);
    setNow(getPosition(soundId));
  };
  const max = Math.floor(now.duration);

  return (
    <div className="flex flex-col gap-1">
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={Math.min(Math.floor(now.position), max)}
        onChange={(event) => seek(Number.parseInt(event.target.value, 10))}
        aria-label={`${name} position`}
        aria-valuetext={`${formatTime(now.position)} of ${formatTime(now.duration)}`}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span className="text-xs font-medium tabular-nums text-textMuted">
          {formatTime(now.position)} / {formatTime(now.duration)}
        </span>
        <div className="flex items-center">
          <button type="button" onClick={() => seek(0)} aria-label={`Restart ${name}`} className={buttonClass}>
            Restart
          </button>
          <button
            type="button"
            onClick={() => seek(now.position - SKIP_SECONDS)}
            aria-label={`Back ${SKIP_SECONDS} seconds in ${name}`}
            className={buttonClass}
          >
            −{SKIP_SECONDS}s
          </button>
          <button
            type="button"
            onClick={() => seek(now.position + SKIP_SECONDS)}
            aria-label={`Forward ${SKIP_SECONDS} seconds in ${name}`}
            className={buttonClass}
          >
            +{SKIP_SECONDS}s
          </button>
        </div>
      </div>
    </div>
  );
}
