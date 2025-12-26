'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-slate-900 hover:bg-accentMuted focus-visible:outline-accent focus-visible:ring-2 focus-visible:ring-accent/40',
  secondary:
    'bg-surfaceRaised text-slate-100 hover:bg-surface focus-visible:outline-accent focus-visible:ring-2 focus-visible:ring-accent/40',
  ghost:
    'bg-transparent text-slate-100 hover:bg-surface focus-visible:outline-accent focus-visible:ring-2 focus-visible:ring-accent/30'
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base'
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-full font-medium transition-colors duration-200 ease-glide disabled:cursor-not-allowed disabled:opacity-50',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
