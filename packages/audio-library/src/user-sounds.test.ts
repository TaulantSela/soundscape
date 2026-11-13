import { describe, expect, it } from 'vitest';
import { buildSharedMixPath, decodeSharedMix } from './share';
import {
  cleanUserSoundName,
  isUserSoundId,
  storedUserSoundType,
  toUserSoundId,
  userSoundExtension,
  userSoundNameFromFile,
  userSoundUuid
} from './user-sounds';

const uuid = '3f2a9c1e-7b4d-4e8a-9f10-2c3d4e5f6a7b';

describe('user sound ids', () => {
  it('round-trips a uuid through the mixer id', () => {
    const id = toUserSoundId(uuid.toUpperCase());
    expect(id).toBe(`u-${uuid}`);
    expect(isUserSoundId(id)).toBe(true);
    expect(userSoundUuid(id)).toBe(uuid);
  });

  it('rejects anything that is not exactly u-<uuid>', () => {
    for (const id of ['rain-shower', uuid, `u-${uuid}x`, `u-${uuid.slice(1)}`, `x-${uuid}`, `u-${uuid}:50`]) {
      expect(isUserSoundId(id)).toBe(false);
      expect(userSoundUuid(id)).toBeUndefined();
    }
  });
});

describe('user sound files', () => {
  it('maps supported audio types to an extension, ignoring parameters and case', () => {
    expect(userSoundExtension('audio/mpeg')).toBe('mp3');
    expect(userSoundExtension('Audio/X-M4A; codecs=mp4a')).toBe('m4a');
    expect(userSoundExtension('audio/wav')).toBe('wav');
    expect(userSoundExtension('video/mp4')).toBeUndefined();
    expect(userSoundExtension('application/octet-stream')).toBeUndefined();
  });

  it('reserves uploads under the type storage files their extension as', () => {
    // Vercel Blob types a file by its extension, so a browser's alias must not reach it.
    expect(storedUserSoundType('audio/x-m4a')).toBe('audio/mp4');
    expect(storedUserSoundType('audio/mp4')).toBe('audio/mp4');
    expect(storedUserSoundType('audio/mp3')).toBe('audio/mpeg');
    expect(storedUserSoundType('audio/aac')).toBe('audio/x-aac');
    expect(storedUserSoundType('audio/x-wav; codecs=1')).toBe('audio/wav');
    expect(storedUserSoundType('audio/wave')).toBe('audio/wav');
    expect(storedUserSoundType('audio/ogg')).toBeUndefined();
  });

  it('cleans names and derives one from a file name', () => {
    expect(cleanUserSoundName('  Rain   on  the\ttent ')).toBe('Rain on the tent');
    expect(cleanUserSoundName('   ')).toBeUndefined();
    expect(cleanUserSoundName('x'.repeat(80))).toHaveLength(60);
    expect(userSoundNameFromFile('my_field_recording.WAV')).toBe('my field recording');
    expect(userSoundNameFromFile('.mp3')).toBe('My sound');
  });
});

describe('shared mixes with uploaded sounds', () => {
  it('keeps user sound ids in the link alongside built-in sounds', () => {
    const id = toUserSoundId(uuid);
    const path = buildSharedMixPath({
      sounds: [
        { soundId: 'rain-shower', volume: 0.4 },
        { soundId: id, volume: 0.7 }
      ],
      masterVolume: 0.8
    });
    expect(path).toBe(`/mix?s=rain-shower:40,${id}:70&v=80`);
    expect(decodeSharedMix(path.split('?')[1])?.sounds).toEqual([
      { soundId: 'rain-shower', volume: 0.4 },
      { soundId: id, volume: 0.7 }
    ]);
  });

  it('still drops malformed ids and accepts a custom predicate', () => {
    expect(decodeSharedMix(`s=u-not-a-uuid:50,rain-shower:40`)?.sounds).toEqual([{ soundId: 'rain-shower', volume: 0.4 }]);
    expect(decodeSharedMix(`s=u-${uuid}:50`, (id) => id === 'rain-shower')).toBeNull();
    expect(decodeSharedMix('s=rain-shower:40', ['rain-shower'])?.sounds).toHaveLength(1);
  });
});
