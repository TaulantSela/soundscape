import { describe, expect, it } from 'vitest';
import { buildSharedMixPath, decodeSharedMix, encodeSharedMix } from './share';

describe('shared mix links', () => {
  it('round-trips sounds, master volume and name', () => {
    const query = encodeSharedMix({
      sounds: [
        { soundId: 'rain-shower', volume: 0.6 },
        { soundId: 'brown-noise', volume: 0.35 }
      ],
      masterVolume: 0.8,
      name: 'Late shift'
    });

    expect(query).toBe('s=rain-shower:60,brown-noise:35&v=80&n=Late%20shift');
    expect(decodeSharedMix(query)).toEqual({
      sounds: [
        { soundId: 'rain-shower', volume: 0.6 },
        { soundId: 'brown-noise', volume: 0.35 }
      ],
      masterVolume: 0.8,
      name: 'Late shift'
    });
  });

  it('builds a /mix path', () => {
    expect(buildSharedMixPath({ sounds: [{ soundId: 'ocean-tide', volume: 0.5 }], masterVolume: 1 })).toBe(
      '/mix?s=ocean-tide:50&v=100'
    );
  });

  it('accepts Next.js searchParams objects and URLSearchParams', () => {
    expect(decodeSharedMix({ s: 'ocean-tide:50', v: '70' })?.masterVolume).toBe(0.7);
    expect(decodeSharedMix(new URLSearchParams('s=ocean-tide%3A50'))?.sounds).toHaveLength(1);
  });

  it('drops unknown sounds, duplicates and malformed volumes', () => {
    const mix = decodeSharedMix('s=rain-shower:40,rain-shower:90,nope:50,ocean-tide:abc,airy-wind:101,city-hum:0,lofi-piano:30');
    expect(mix?.sounds).toEqual([
      { soundId: 'rain-shower', volume: 0.4 },
      { soundId: 'lofi-piano', volume: 0.3 }
    ]);
  });

  it('returns null when nothing playable is left, and defaults the master volume', () => {
    expect(decodeSharedMix('s=nope:50')).toBeNull();
    expect(decodeSharedMix('')).toBeNull();
    expect(decodeSharedMix('s=rain-shower:40')?.masterVolume).toBe(0.8);
    expect(decodeSharedMix('s=rain-shower:40&v=0')?.masterVolume).toBe(0);
  });
});
