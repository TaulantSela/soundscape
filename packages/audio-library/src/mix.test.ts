import { describe, expect, it } from 'vitest';
import { applyPresetToMix, createEmptyMix, hasActiveSounds, serializeMix, toggleSound } from './mix';
import { builtInPresets, getPresetById } from './presets';
import { soundIds } from './sounds';

describe('applyPresetToMix', () => {
  it('replaces the whole mix instead of layering presets on top of each other', () => {
    const focus = getPresetById('focus-flow')!;
    const cozy = getPresetById('cozy-night')!;

    let mix = createEmptyMix(soundIds);
    mix = applyPresetToMix(mix, focus.mix);
    mix = applyPresetToMix(mix, cozy.mix);

    expect(serializeMix(mix)).toEqual(cozy.mix);
    expect(Object.keys(mix.gains).sort()).toEqual([...soundIds].sort());
  });

  it('references only sounds that exist in the library', () => {
    for (const preset of builtInPresets) {
      for (const item of preset.mix) {
        expect(soundIds).toContain(item.soundId);
      }
    }
  });
});

describe('toggleSound', () => {
  it('switches a sound on at the requested volume and off again', () => {
    const mix = createEmptyMix(soundIds);
    const on = toggleSound(mix, 'rain-shower', 0.7);
    expect(on.gains['rain-shower']).toBe(0.7);
    expect(hasActiveSounds(on)).toBe(true);

    const off = toggleSound(on, 'rain-shower', 0.7);
    expect(off.gains['rain-shower']).toBe(0);
    expect(hasActiveSounds(off)).toBe(false);
  });

  it('never switches a sound "on" at zero volume', () => {
    const mix = createEmptyMix(soundIds);
    expect(toggleSound(mix, 'rain-shower', 0).gains['rain-shower']).toBeGreaterThan(0);
  });
});
