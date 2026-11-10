import {
  MAX_USER_SOUND_BYTES,
  MAX_USER_SOUND_SECONDS,
  userSoundExtension,
  type UserSound,
  type UserSoundsResponse
} from '@soundscape/audio-library';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: 'no-store',
    headers: { 'content-type': 'application/json', ...init?.headers }
  });
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    throw new ApiError(body?.error ?? `Request failed (${response.status}).`, response.status);
  }
  return body as T;
}

export function fetchUserSounds() {
  return request<UserSoundsResponse>('/api/sounds');
}

export function deleteUserSound(id: string) {
  return request<{ ok: true }>(`/api/sounds/${id}`, { method: 'DELETE' });
}

/** Download one of the user's own files through a short-lived signed URL. */
export async function fetchUserSoundBytes(id: string): Promise<ArrayBuffer> {
  const { url } = await request<{ url: string }>(`/api/sounds/${id}/file`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new ApiError("Couldn't download the sound.", response.status);
  }
  return response.arrayBuffer();
}

const TYPE_BY_EXTENSION: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav'
};

/** Accepted by the file picker. Some systems report no type for .m4a/.aac. */
export const AUDIO_FILE_ACCEPT = 'audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,.mp3,.m4a,.aac,.wav';

function contentTypeFor(file: File) {
  if (file.type && userSoundExtension(file.type)) {
    return file.type;
  }
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return TYPE_BY_EXTENSION[extension];
}

function formatMinutes(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/**
 * Check a file before uploading it: a supported type, not too large, and
 * audio this browser can decode that is no longer than the limit.
 */
export async function inspectAudioFile(file: File) {
  const contentType = contentTypeFor(file);
  if (!contentType) {
    throw new ApiError('Upload an MP3, M4A, AAC or WAV file.', 415);
  }
  if (file.size > MAX_USER_SOUND_BYTES) {
    throw new ApiError(`Files can be up to ${MAX_USER_SOUND_BYTES / (1024 * 1024)} MB.`, 413);
  }

  let seconds: number;
  try {
    const context = new OfflineAudioContext(1, 1, 44100);
    seconds = (await context.decodeAudioData(await file.arrayBuffer())).duration;
  } catch {
    throw new ApiError("That file couldn't be read as audio.", 422);
  }
  if (seconds < 1) {
    throw new ApiError('That sound is shorter than a second.', 422);
  }
  if (seconds > MAX_USER_SOUND_SECONDS) {
    throw new ApiError(
      `Sounds can be up to ${formatMinutes(MAX_USER_SOUND_SECONDS)} long; this one is ${formatMinutes(seconds)}.`,
      422
    );
  }
  return { contentType, seconds };
}

function putFile(url: string, file: File, contentType: string, onProgress?: (fraction: number) => void) {
  // XMLHttpRequest, not fetch: it reports upload progress.
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(event.loaded / event.total);
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError('Storage rejected the upload.', xhr.status));
    xhr.onerror = () => reject(new ApiError('The upload failed. Check your connection and try again.', 0));
    xhr.send(file);
  });
}

/** Reserve, upload straight to storage, then confirm. */
export async function uploadUserSound(
  file: File,
  name: string,
  onProgress?: (fraction: number) => void
): Promise<UserSound> {
  const { contentType } = await inspectAudioFile(file);
  const reservation = await request<{ id: string; uploadUrl: string; contentType: string }>('/api/sounds/uploads', {
    method: 'POST',
    body: JSON.stringify({ name, contentType, sizeBytes: file.size })
  });
  await putFile(reservation.uploadUrl, file, reservation.contentType, onProgress);
  return request<UserSound>(`/api/sounds/${reservation.id}/complete`, { method: 'POST' });
}
