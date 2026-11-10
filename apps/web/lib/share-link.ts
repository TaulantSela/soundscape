export type ShareOutcome = 'shared' | 'copied' | 'manual' | 'cancelled';

/**
 * Share a link from a click handler. Nothing is awaited before the first
 * share/clipboard call, so Safari still sees the user gesture.
 */
export async function shareLink(url: string, title: string): Promise<ShareOutcome> {
  const prefersShareSheet =
    typeof navigator.share === 'function' && window.matchMedia?.('(pointer: coarse)').matches;

  if (prefersShareSheet) {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    // Clipboard blocked (insecure context, permissions, lost gesture).
  }

  window.prompt('Copy this link to share your mix:', url);
  return 'manual';
}
