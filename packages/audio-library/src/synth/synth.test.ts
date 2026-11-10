import { describe, expect, it } from 'vitest';
import { soundLibrary } from '../sounds';
import { encodeWav, hasSynth, renderSound } from './index';

describe('renderSound', () => {
  it('has a synthesizer for every sound without a recording', () => {
    for (const sound of soundLibrary) {
      expect(sound.file || hasSynth(sound.id)).toBeTruthy();
    }
  });

  it.each(soundLibrary.map((sound) => sound.id))('renders a clean, seamless loop for %s', (id) => {
    const sound = renderSound(id, { sampleRate: 8000, channels: 2 });
    expect(sound.channels).toHaveLength(2);

    for (const channel of sound.channels) {
      expect(channel.length).toBe(Math.round(sound.loopSeconds * 8000));
      let peak = 0;
      let largestStep = 0;
      let nonFinite = 0;
      for (let i = 0; i < channel.length; i++) {
        if (!Number.isFinite(channel[i])) {
          nonFinite++;
        }
        peak = Math.max(peak, Math.abs(channel[i]));
        if (i > 0) {
          largestStep = Math.max(largestStep, Math.abs(channel[i] - channel[i - 1]));
        }
      }
      expect(nonFinite).toBe(0);
      expect(peak).toBeGreaterThan(0.05);
      expect(peak).toBeLessThanOrEqual(0.95 + 1e-6);
      // The jump from the last sample back to the first must be no bigger
      // than ordinary sample-to-sample movement inside the loop.
      expect(Math.abs(channel[0] - channel[channel.length - 1])).toBeLessThanOrEqual(largestStep);
    }
  });

  it('is deterministic', () => {
    const a = renderSound('rain-shower', { sampleRate: 8000, channels: 1 });
    const b = renderSound('rain-shower', { sampleRate: 8000, channels: 1 });
    expect(a.channels[0]).toEqual(b.channels[0]);
  });

  it('rejects unknown sounds', () => {
    expect(() => renderSound('nope')).toThrow(/No synthesizer/);
  });
});

describe('encodeWav', () => {
  it('writes a valid 16-bit PCM header', () => {
    const bytes = encodeWav({ sampleRate: 22050, channels: [new Float32Array([0, 0.5, -0.5, 1])] });
    const view = new DataView(bytes.buffer);
    const ascii = (offset: number) => String.fromCharCode(...bytes.slice(offset, offset + 4));

    expect(ascii(0)).toBe('RIFF');
    expect(ascii(8)).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(22050);
    expect(view.getUint32(40, true)).toBe(8);
    expect(view.getInt16(44 + 6, true)).toBe(0x7fff);
  });
});
