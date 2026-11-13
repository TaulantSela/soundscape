import { del, head, issueSignedToken, presignUrl } from '@vercel/blob';
import {
  MAX_USER_SOUND_BYTES,
  MAX_USER_SOUNDS,
  MAX_USER_STORAGE_BYTES,
  cleanUserSoundName,
  isUuid,
  storedUserSoundType,
  userSoundExtension,
  type UserSound,
  type UserSoundsResponse
} from '@soundscape/audio-library';
import { getSql } from './db';

/** How long an issued upload URL reserves quota before the upload must be confirmed. */
const PENDING_MINUTES = 15;
const UPLOAD_URL_TTL_MS = 10 * 60_000;
const FILE_URL_TTL_MS = 15 * 60_000;

/** A failure the user can act on; `status` is the HTTP status to answer with. */
export class UserSoundError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

interface UserSoundRow {
  id: string;
  name: string;
  pathname: string;
  content_type: string;
  size_bytes: number;
  status: 'pending' | 'ready';
  created_at: string | Date;
}

function toUserSound(row: UserSoundRow): UserSound {
  return {
    id: row.id,
    name: row.name,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    createdAt: new Date(row.created_at).toISOString()
  };
}

function megabytes(bytes: number) {
  return Math.round(bytes / (1024 * 1024));
}

function requireUuid(id: string) {
  if (!isUuid(id)) {
    throw new UserSoundError('Sound not found.', 404);
  }
  return id;
}

async function findOwned(userId: string, id: string) {
  const rows = (await getSql()`
    select id, name, pathname, content_type, size_bytes, status, created_at
    from user_sounds
    where id = ${requireUuid(id)} and user_id = ${userId}
  `) as UserSoundRow[];
  return rows[0];
}

/**
 * Drop reservations whose upload was never confirmed, and any file that did
 * arrive for them. Runs before each new reservation, so it needs no cron.
 */
async function removeStaleReservations(userId: string) {
  const stale = (await getSql()`
    delete from user_sounds
    where user_id = ${userId}
      and status = 'pending'
      and created_at < now() - make_interval(mins => ${PENDING_MINUTES})
    returning pathname
  `) as Pick<UserSoundRow, 'pathname'>[];
  if (stale.length > 0) {
    await del(stale.map((row) => row.pathname)).catch((error: unknown) => {
      console.warn('Could not delete abandoned uploads', error);
    });
  }
}

export async function listUserSounds(userId: string): Promise<UserSoundsResponse> {
  const rows = (await getSql()`
    select id, name, pathname, content_type, size_bytes, status, created_at
    from user_sounds
    where user_id = ${userId} and status = 'ready'
    order by created_at
  `) as UserSoundRow[];

  return {
    sounds: rows.map(toUserSound),
    usage: {
      count: rows.length,
      bytes: rows.reduce((total, row) => total + row.size_bytes, 0),
      maxCount: MAX_USER_SOUNDS,
      maxBytes: MAX_USER_STORAGE_BYTES,
      maxFileBytes: MAX_USER_SOUND_BYTES
    }
  };
}

export interface UploadReservation {
  id: string;
  /** Presigned `PUT` URL for exactly this file; send the body with `contentType`. */
  uploadUrl: string;
  contentType: string;
  expiresAt: number;
}

/**
 * Reserve room for one upload and return a URL the client PUTs the file to.
 * Blob itself rejects a different pathname, a larger file or another type.
 */
export async function reserveUpload(
  userId: string,
  input: { name: string; contentType: string; sizeBytes: number }
): Promise<UploadReservation> {
  const name = cleanUserSoundName(input.name);
  if (!name) {
    throw new UserSoundError('Give the sound a name.', 400);
  }
  const extension = userSoundExtension(input.contentType);
  const contentType = storedUserSoundType(input.contentType);
  if (!extension || !contentType) {
    throw new UserSoundError('Upload an MP3, M4A, AAC or WAV file.', 415);
  }
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new UserSoundError('That file is empty.', 400);
  }
  if (input.sizeBytes > MAX_USER_SOUND_BYTES) {
    throw new UserSoundError(`Files can be up to ${megabytes(MAX_USER_SOUND_BYTES)} MB.`, 413);
  }

  await removeStaleReservations(userId);

  const id = crypto.randomUUID();
  const pathname = `users/${userId}/${id}.${extension}`;
  const sql = getSql();
  // The advisory lock serialises reservations per user, so two uploads at
  // once can't both slip under the quota.
  const [, inserted] = (await sql.transaction([
    sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`,
    sql`
      insert into user_sounds (id, user_id, name, pathname, content_type, size_bytes)
      select ${id}, ${userId}, ${name}, ${pathname}, ${contentType}, ${input.sizeBytes}
      from (
        select count(*) as sounds, coalesce(sum(size_bytes), 0) as bytes
        from user_sounds
        where user_id = ${userId}
          and (status = 'ready' or created_at > now() - make_interval(mins => ${PENDING_MINUTES}))
      ) usage
      where usage.sounds < ${MAX_USER_SOUNDS}
        and usage.bytes + ${input.sizeBytes} <= ${MAX_USER_STORAGE_BYTES}
      returning id
    `
  ])) as [unknown, { id: string }[]];

  if (inserted.length === 0) {
    throw new UserSoundError(
      `Your library is full (${MAX_USER_SOUNDS} sounds or ${megabytes(MAX_USER_STORAGE_BYTES)} MB). Delete a sound to make room.`,
      409
    );
  }

  const expiresAt = Date.now() + UPLOAD_URL_TTL_MS;
  const constraints = { allowedContentTypes: [contentType], maximumSizeInBytes: input.sizeBytes };
  const token = await issueSignedToken({ pathname, operations: ['put'], validUntil: expiresAt, ...constraints });
  const { presignedUrl } = await presignUrl(token, {
    operation: 'put',
    pathname,
    access: 'private',
    validUntil: expiresAt,
    allowOverwrite: false,
    addRandomSuffix: false,
    ...constraints
  });

  return { id, uploadUrl: presignedUrl, contentType, expiresAt };
}

/** Confirm an upload landed in storage, using the file's real size and type. */
export async function completeUpload(userId: string, id: string): Promise<UserSound> {
  const row = await findOwned(userId, id);
  if (!row) {
    throw new UserSoundError('Sound not found.', 404);
  }
  if (row.status === 'ready') {
    return toUserSound(row);
  }

  const blob = await head(row.pathname).catch(() => null);
  if (!blob) {
    throw new UserSoundError("The file didn't reach storage. Try uploading it again.", 409);
  }
  if (blob.size > row.size_bytes || !userSoundExtension(blob.contentType)) {
    await deleteUserSound(userId, id);
    throw new UserSoundError("That file doesn't match what was announced, so it was removed.", 422);
  }

  const updated = (await getSql()`
    update user_sounds
    set status = 'ready', size_bytes = ${blob.size}, content_type = ${blob.contentType.toLowerCase()}
    where id = ${row.id} and user_id = ${userId}
    returning id, name, pathname, content_type, size_bytes, status, created_at
  `) as UserSoundRow[];
  return toUserSound(updated[0]);
}

export async function deleteUserSound(userId: string, id: string) {
  const row = await findOwned(userId, id);
  if (!row) {
    throw new UserSoundError('Sound not found.', 404);
  }
  // File first: if this fails the row stays, so the user can try again
  // instead of being left with an orphaned file they can't see.
  await del(row.pathname);
  await getSql()`delete from user_sounds where id = ${row.id} and user_id = ${userId}`;
}

/** A short-lived URL that reads one of the user's own files straight from Blob. */
export async function getUserSoundFileUrl(userId: string, id: string) {
  const row = await findOwned(userId, id);
  if (!row || row.status !== 'ready') {
    throw new UserSoundError('Sound not found.', 404);
  }
  const expiresAt = Date.now() + FILE_URL_TTL_MS;
  const token = await issueSignedToken({ pathname: row.pathname, operations: ['get'], validUntil: expiresAt });
  const { presignedUrl } = await presignUrl(token, {
    operation: 'get',
    pathname: row.pathname,
    access: 'private',
    validUntil: expiresAt
  });
  return { url: presignedUrl, contentType: row.content_type, expiresAt };
}
