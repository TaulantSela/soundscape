import {
  MAX_USER_SOUND_BYTES,
  MAX_USER_SOUND_SECONDS,
  userSoundExtension,
  type UserSound,
  type UserSoundsResponse,
} from '@soundscape/audio-library';
import { createAudioPlayer } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import { FileSystemUploadType, createUploadTask } from 'expo-file-system/legacy';

import { ACCOUNT } from './config';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

/** A fresh access token; `force` refreshes even if the current one looks valid. */
export type GetAccessToken = (force?: boolean) => Promise<string>;

async function request<T>(
  getAccessToken: GetAccessToken,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const send = async (token: string) =>
    fetch(`${ACCOUNT.webUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
  let response = await send(await getAccessToken());
  if (response.status === 401) {
    // Revoked or expired early: one refresh, then give up.
    response = await send(await getAccessToken(true));
  }
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    throw new ApiError(body?.error ?? `Request failed (${response.status}).`, response.status);
  }
  return body as T;
}

export function fetchUserSounds(getAccessToken: GetAccessToken) {
  return request<UserSoundsResponse>(getAccessToken, '/api/sounds');
}

export function deleteUserSound(getAccessToken: GetAccessToken, id: string) {
  return request<{ ok: true }>(getAccessToken, `/api/sounds/${id}`, { method: 'DELETE' });
}

// Uploads never change once stored, so a downloaded copy stays valid; it's
// deleted with the sound, and all of them when signing out.
const filesDirectory = () => new Directory(Paths.cache, 'user-sounds');

function cachedFile(sound: Pick<UserSound, 'id' | 'contentType'>) {
  return new File(
    filesDirectory(),
    `${sound.id}.${userSoundExtension(sound.contentType) ?? 'audio'}`
  );
}

const downloads = new Map<string, Promise<string>>();

/** A local file URI for one of the user's sounds, downloading it once. */
export function userSoundFile(getAccessToken: GetAccessToken, sound: UserSound): Promise<string> {
  const file = cachedFile(sound);
  if (file.exists && file.size > 0) {
    return Promise.resolve(file.uri);
  }
  let download = downloads.get(sound.id);
  if (!download) {
    download = (async () => {
      const { url } = await request<{ url: string }>(
        getAccessToken,
        `/api/sounds/${sound.id}/file`
      );
      const directory = filesDirectory();
      if (!directory.exists) {
        directory.create({ intermediates: true });
      }
      const partial = new File(directory, `${sound.id}.part`);
      if (partial.exists) partial.delete();
      const downloaded = await File.downloadFileAsync(url, partial);
      downloaded.move(file);
      return file.uri;
    })().finally(() => downloads.delete(sound.id));
    downloads.set(sound.id, download);
  }
  return download;
}

export function forgetUserSoundFile(sound: Pick<UserSound, 'id' | 'contentType'>) {
  const file = cachedFile(sound);
  if (file.exists) file.delete();
}

export function forgetAllUserSoundFiles() {
  const directory = filesDirectory();
  if (directory.exists) directory.delete();
}

export interface PickedAudio {
  uri: string;
  name: string;
  size: number;
  contentType: string;
}

const TYPE_BY_EXTENSION: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
};

function formatMinutes(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
}

/** How long a local audio file is, from the native player (it streams; nothing is decoded up front). */
function readDuration(uri: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const player = createAudioPlayer({ uri });
    let settled = false;
    const finish = (result: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(poll);
      subscription.remove();
      player.remove();
      result();
    };
    const check = () => {
      if (player.isLoaded && player.duration > 0) finish(() => resolve(player.duration));
    };
    // The status event is enough on most devices; polling covers a paused
    // player that never reports one.
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.isLoaded && status.duration > 0) finish(() => resolve(status.duration));
    });
    const poll = setInterval(check, 200);
    const timer = setTimeout(() => finish(() => reject(new Error('timeout'))), 10_000);
  });
}

/** The same checks as the website: a supported type, not too big, 1 s to 10 min. */
export async function inspectPickedAudio(file: {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
}): Promise<PickedAudio> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const contentType =
    file.mimeType && userSoundExtension(file.mimeType)
      ? file.mimeType
      : TYPE_BY_EXTENSION[extension];
  if (!contentType) {
    throw new ApiError('Upload an MP3, M4A, AAC or WAV file.', 415);
  }
  const size = file.size ?? new File(file.uri).size;
  if (size > MAX_USER_SOUND_BYTES) {
    const limit = `Files can be up to ${MAX_USER_SOUND_BYTES / (1024 * 1024)} MB`;
    throw new ApiError(
      userSoundExtension(contentType) === 'wav'
        ? `${limit}, and WAV files are large. Save it as MP3 or M4A first.`
        : `${limit}.`,
      413
    );
  }
  const seconds = await readDuration(file.uri).catch(() => {
    throw new ApiError("That file couldn't be read as audio.", 422);
  });
  if (seconds < 1) {
    throw new ApiError('That sound is shorter than a second.', 422);
  }
  if (seconds > MAX_USER_SOUND_SECONDS) {
    throw new ApiError(
      `Sounds can be up to ${formatMinutes(MAX_USER_SOUND_SECONDS)} long; this one is ${formatMinutes(seconds)}.`,
      422
    );
  }
  return { uri: file.uri, name: file.name, size, contentType };
}

/** Reserve room, upload straight to storage (with progress), then confirm. */
export async function uploadUserSound(
  getAccessToken: GetAccessToken,
  file: PickedAudio,
  name: string,
  onProgress: (fraction: number) => void
): Promise<UserSound> {
  const reservation = await request<{ id: string; uploadUrl: string; contentType: string }>(
    getAccessToken,
    '/api/sounds/uploads',
    {
      method: 'POST',
      body: JSON.stringify({ name, contentType: file.contentType, sizeBytes: file.size }),
    }
  );
  const task = createUploadTask(
    reservation.uploadUrl,
    file.uri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: { 'content-type': reservation.contentType },
    },
    ({ totalBytesSent, totalBytesExpectedToSend }) => {
      if (totalBytesExpectedToSend > 0) onProgress(totalBytesSent / totalBytesExpectedToSend);
    }
  );
  const result = await task.uploadAsync();
  if (!result || result.status < 200 || result.status >= 300) {
    throw new ApiError('Storage rejected the upload.', result?.status ?? 0);
  }
  return request<UserSound>(getAccessToken, `/api/sounds/${reservation.id}/complete`, {
    method: 'POST',
  });
}
