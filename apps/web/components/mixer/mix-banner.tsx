'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MixBannerProps {
  title: string;
  description?: string;
  onSave?: () => void;
  showSave?: boolean;
  className?: string;
}

export function MixBanner({ title, description, onSave, showSave = false, className }: MixBannerProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-3xl border border-accent/40 bg-surface/80 p-4 text-slate-100 shadow-glow backdrop-blur-sm md:flex-row md:items-center md:justify-between',
        className
      )}
    >
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="text-sm text-textMuted">{description}</p> : null}
      </div>
      {showSave && onSave ? (
        <Button size="sm" onClick={onSave}>
          Save to My Presets
        </Button>
      ) : null}
    </div>
  );
}
