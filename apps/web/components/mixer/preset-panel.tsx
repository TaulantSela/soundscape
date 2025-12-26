'use client';

import type { PresetDefinition } from '@soundscape/audio-library';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PresetPanelProps {
  presets: PresetDefinition[];
  activePresetId?: string;
  onApply: (presetId: string) => void;
}

export function PresetPanel({ presets, activePresetId, onApply }: PresetPanelProps) {
  return (
    <aside className="flex h-full flex-col gap-4 rounded-3xl border border-surfaceRaised bg-surface/80 p-4 backdrop-blur">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">Presets</h2>
        <span className="text-xs text-textMuted">Built-in</span>
      </header>
      <div className="flex flex-col gap-2 overflow-y-auto pr-1">
        {presets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onApply(preset.id)}
            className={cn(
              'flex w-full items-center justify-between rounded-2xl border border-transparent bg-surfaceRaised px-4 py-3 text-left transition-colors duration-200 ease-glide hover:border-accent/30',
              preset.id === activePresetId && 'border-accent/60 shadow-glow'
            )}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden>
                {preset.emoji ?? '🎶'}
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-100">{preset.name}</span>
                {preset.description ? <span className="text-xs text-textMuted">{preset.description}</span> : null}
              </div>
            </div>
            <span className="text-xs uppercase tracking-wide text-textMuted">Apply</span>
          </button>
        ))}
      </div>
      <footer className="mt-auto space-y-2 text-xs text-textMuted">
        <p>Sign in to create custom presets, update, and share them across devices.</p>
        <Button variant="secondary" size="sm" className="w-full" disabled>
          Coming soon: Save current mix
        </Button>
      </footer>
    </aside>
  );
}
