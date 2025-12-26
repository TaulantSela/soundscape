'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ className, label, min = 0, max = 100, step = 1, ...props }, ref) => {
    return (
      <label className="flex w-full flex-col gap-1">
        {label ? <span className="text-xs uppercase tracking-wide text-textMuted">{label}</span> : null}
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          className={cn(
            'h-2 w-full cursor-pointer appearance-none rounded-full bg-surfaceRaised accent-accent',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            className
          )}
          {...props}
        />
      </label>
    );
  }
);

Slider.displayName = 'Slider';
