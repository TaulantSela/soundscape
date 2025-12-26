'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ShareMixButtonProps {
  onShare: () => Promise<void>;
  disabled?: boolean;
}

export function ShareMixButton({ onShare, disabled }: ShareMixButtonProps) {
  const [isSharing, setIsSharing] = useState(false);

  async function handleShare() {
    if (isSharing || disabled) {
      return;
    }

    try {
      setIsSharing(true);
      await onShare();
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <Button variant="secondary" size="md" onClick={handleShare} disabled={disabled || isSharing}>
      {isSharing ? 'Sharing…' : 'Share mix'}
    </Button>
  );
}
