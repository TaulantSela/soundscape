// Renders synthesized loops off the main thread, so switching sounds on never
// stalls the UI. Imports only the synth entry point (no zod, no sound list).
import { renderSound } from '@soundscape/audio-library/synth';

export interface SynthRequest {
  id: number;
  soundId: string;
  sampleRate: number;
}

export type SynthResponse =
  | { id: number; ok: true; sampleRate: number; channels: Float32Array[] }
  | { id: number; ok: false; error: string };

interface WorkerScope {
  onmessage: ((event: MessageEvent<SynthRequest>) => void) | null;
  postMessage(message: SynthResponse, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  const { id, soundId, sampleRate } = event.data;
  try {
    const sound = renderSound(soundId, { sampleRate, channels: 2 });
    scope.postMessage(
      { id, ok: true, sampleRate: sound.sampleRate, channels: sound.channels },
      sound.channels.map((channel) => channel.buffer)
    );
  } catch (error) {
    scope.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
