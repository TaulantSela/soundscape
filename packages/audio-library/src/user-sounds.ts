/**
 * Sounds people upload to their own account. Only the owner can play them:
 * a shared mix that uses one plays for everyone else without that layer.
 *
 * Their mixer ids are `u-<uuid>`, so they fit the `[a-z0-9-]` ids that share
 * links use (`:` separates an id from its volume there).
 */
export const USER_SOUND_ID_PREFIX = 'u-';

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const USER_SOUND_ID = new RegExp(`^${USER_SOUND_ID_PREFIX}(${UUID_PATTERN})$`);
const UUID = new RegExp(`^${UUID_PATTERN}$`);

export const MAX_USER_SOUND_BYTES = 20 * 1024 * 1024;
export const MAX_USER_SOUNDS = 50;
export const MAX_USER_STORAGE_BYTES = 200 * 1024 * 1024;
export const MAX_USER_SOUND_NAME_LENGTH = 60;
/**
 * Browsers decode a layer into raw samples (about 23 MB per stereo minute at
 * 48 kHz), so long files would exhaust memory on phones. Ambient loops rarely
 * need more than this.
 */
export const MAX_USER_SOUND_SECONDS = 180;

/** Audio formats every client can decode, with the extension stored files get. */
export const USER_SOUND_TYPES: Readonly<Record<string, string>> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav'
};

export function isUserSoundId(id: string) {
  return USER_SOUND_ID.test(id);
}

export function isUuid(value: string) {
  return UUID.test(value);
}

export function toUserSoundId(uuid: string) {
  return `${USER_SOUND_ID_PREFIX}${uuid.toLowerCase()}`;
}

/** The database id behind a mixer id, or `undefined` if it isn't a user sound. */
export function userSoundUuid(id: string) {
  return USER_SOUND_ID.exec(id)?.[1];
}

/** Normalise a content type (drop parameters, lower-case) and check it's allowed. */
export function userSoundExtension(contentType: string) {
  const type = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return USER_SOUND_TYPES[type];
}

/** Trim and collapse whitespace; returns `undefined` when nothing usable is left. */
export function cleanUserSoundName(name: string) {
  const cleaned = name.replace(/\s+/g, ' ').trim().slice(0, MAX_USER_SOUND_NAME_LENGTH).trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

/** A name from a file name: no extension, separators turned into spaces. */
export function userSoundNameFromFile(fileName: string) {
  const base = fileName.replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[_]+/g, ' ');
  return cleanUserSoundName(base) ?? 'My sound';
}

/** One uploaded sound, as the API returns it. */
export interface UserSound {
  /** Database id (uuid). The mixer uses `toUserSoundId(id)`. */
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface UserSoundsResponse {
  sounds: UserSound[];
  usage: { count: number; bytes: number; maxCount: number; maxBytes: number; maxFileBytes: number };
}
