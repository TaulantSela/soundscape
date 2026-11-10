import { DEFAULT_SYNTH_SAMPLE_RATE } from '@soundscape/audio-library/synth';
import type { SynthRequest, SynthResponse } from '@/workers/synth.worker';

export interface RenderedLoop {
  sampleRate: number;
  channels: Float32Array[];
}

interface PendingRender {
  resolve: (loop: RenderedLoop) => void;
  reject: (error: Error) => void;
}

let worker: Worker | null | undefined;
let nextRequestId = 0;
const pending = new Map<number, PendingRender>();

function failAll(error: Error) {
  pending.forEach((request) => request.reject(error));
  pending.clear();
}

function getWorker(): Worker | null {
  if (worker !== undefined) {
    return worker;
  }

  try {
    worker = new Worker(new URL('../workers/synth.worker.ts', import.meta.url));
    worker.onmessage = (event: MessageEvent<SynthResponse>) => {
      const response = event.data;
      const request = pending.get(response.id);
      if (!request) {
        return;
      }
      pending.delete(response.id);
      if (response.ok) {
        request.resolve({ sampleRate: response.sampleRate, channels: response.channels });
      } else {
        request.reject(new Error(response.error));
      }
    };
    worker.onerror = (event) => {
      // A broken worker falls back to rendering on the main thread.
      event.preventDefault();
      worker?.terminate();
      worker = null;
      failAll(new Error('Synth worker failed'));
    };
  } catch {
    worker = null;
  }

  return worker;
}

async function renderOnMainThread(soundId: string): Promise<RenderedLoop> {
  const { renderSound } = await import('@soundscape/audio-library/synth');
  return renderSound(soundId, { sampleRate: DEFAULT_SYNTH_SAMPLE_RATE, channels: 2 });
}

/** Render a synthesized loop, in a worker when the browser allows it. */
export function renderSynthLoop(soundId: string): Promise<RenderedLoop> {
  const synthWorker = getWorker();
  if (!synthWorker) {
    return renderOnMainThread(soundId);
  }

  return new Promise<RenderedLoop>((resolve, reject) => {
    const id = nextRequestId++;
    pending.set(id, { resolve, reject });
    const request: SynthRequest = { id, soundId, sampleRate: DEFAULT_SYNTH_SAMPLE_RATE };
    synthWorker.postMessage(request);
  }).catch(() => renderOnMainThread(soundId));
}
