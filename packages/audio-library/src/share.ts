import { DEFAULT_MASTER_VOLUME } from './mix';
import { soundIds as librarySoundIds } from './sounds';
import type { PresetSoundSetting } from './types';
import { isUserSoundId } from './user-sounds';
import { clampVolume } from './volume';

/**
 * Shared mixes travel inside the link itself, so sharing needs no server:
 *
 *   /mix?s=rain-shower:60,brown-noise:35&v=80&n=Late%20shift
 *
 * `s` lists `soundId:volumePercent` pairs, `v` is the master volume percent and
 * `n` an optional name. Volumes are rounded to whole percents.
 */
export const SHARED_MIX_PATH = '/mix';
export const MAX_SHARED_MIX_NAME_LENGTH = 80;

export interface SharedMix {
  sounds: PresetSoundSetting[];
  masterVolume: number;
  name?: string;
}

type QueryInput =
  | URLSearchParams
  | string
  | Record<string, string | string[] | undefined>;

function toPercent(volume: number) {
  return Math.round(clampVolume(volume) * 100);
}

export function encodeSharedMix(mix: SharedMix): string {
  const pairs = mix.sounds
    .filter((item) => toPercent(item.volume) > 0)
    .map((item) => `${item.soundId}:${toPercent(item.volume)}`);

  // Sound ids are [a-z0-9-], and ':' and ',' are valid in a query string, so
  // the pairs stay readable instead of being percent-encoded.
  const parts = [`s=${pairs.join(',')}`, `v=${toPercent(mix.masterVolume)}`];

  const name = mix.name?.trim().slice(0, MAX_SHARED_MIX_NAME_LENGTH);
  if (name) {
    parts.push(`n=${encodeURIComponent(name)}`);
  }

  return parts.join('&');
}

export function buildSharedMixPath(mix: SharedMix) {
  return `${SHARED_MIX_PATH}?${encodeSharedMix(mix)}`;
}

function readParam(input: QueryInput, key: string): string | undefined {
  if (typeof input === 'string') {
    return new URLSearchParams(input.startsWith('?') ? input.slice(1) : input).get(key) ?? undefined;
  }
  if (input instanceof URLSearchParams) {
    return input.get(key) ?? undefined;
  }
  const value = input[key];
  return Array.isArray(value) ? value[0] : value;
}

function parsePercent(raw: string | undefined): number | undefined {
  if (!raw || !/^\d{1,3}$/.test(raw)) {
    return undefined;
  }
  const value = Number.parseInt(raw, 10);
  return value <= 100 ? value / 100 : undefined;
}

const librarySoundIdSet = new Set(librarySoundIds);

/**
 * Built-in sounds, plus uploaded ones: those travel in the link, but only
 * their owner's mixer can play them.
 */
export function isShareableSoundId(id: string) {
  return librarySoundIdSet.has(id) || isUserSoundId(id);
}

/**
 * Parse a shared mix from a query string. Unknown sounds, duplicates and
 * malformed volumes are dropped; returns `null` when no sound is left.
 */
export function decodeSharedMix(
  input: QueryInput,
  knownSoundIds: Iterable<string> | ((id: string) => boolean) = isShareableSoundId
): SharedMix | null {
  const isKnown =
    typeof knownSoundIds === 'function'
      ? knownSoundIds
      : ((ids) => (id: string) => ids.has(id))(new Set(knownSoundIds));
  const seen = new Set<string>();
  const sounds: PresetSoundSetting[] = [];

  for (const entry of (readParam(input, 's') ?? '').split(',')) {
    const [soundId, rawVolume, ...rest] = entry.split(':');
    const volume = parsePercent(rawVolume);
    if (!soundId || rest.length > 0 || !isKnown(soundId) || seen.has(soundId) || !volume) {
      continue;
    }
    seen.add(soundId);
    sounds.push({ soundId, volume });
  }

  if (sounds.length === 0) {
    return null;
  }

  const masterVolume = parsePercent(readParam(input, 'v')) ?? DEFAULT_MASTER_VOLUME;
  const name = readParam(input, 'n')?.trim().slice(0, MAX_SHARED_MIX_NAME_LENGTH) || undefined;

  return name ? { sounds, masterVolume, name } : { sounds, masterVolume };
}
