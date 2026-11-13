import {
  toUserSoundId,
  userSoundUuid,
  type SoundDefinition,
  type UserSound,
  type UserSoundsResponse,
} from '@soundscape/audio-library';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { MobileMixerEngine } from '../audio-engine';
import {
  deleteUserSound,
  fetchUserSounds,
  forgetUserSoundFile,
  uploadUserSound,
  userSoundFile,
  type GetAccessToken,
  type PickedAudio,
} from './api';
import type { AccountStatus } from './use-account';

export type UserSoundsStatus = 'signed-out' | 'loading' | 'ready' | 'error';

function toDefinition(sound: UserSound, index: number): SoundDefinition {
  return {
    id: toUserSoundId(sound.id),
    name: sound.name,
    category: 'mine',
    emoji: '🎙️',
    defaultVolume: 0.6,
    order: 1000 + index,
  };
}

/** The account's uploads: lists them, plays them through the engine, uploads and deletes. */
export function useUserSounds(
  engine: MobileMixerEngine,
  accountStatus: AccountStatus,
  email: string,
  getAccessToken: GetAccessToken
) {
  // The last list fetched, and for whom: another account's list is never shown.
  const [library, setLibrary] = useState<{
    owner: string;
    status: 'ready' | 'error';
    data?: UserSoundsResponse;
  } | null>(null);
  const [reloads, setReloads] = useState(0);
  const signedIn = accountStatus === 'signed-in';

  useEffect(() => {
    if (!signedIn) {
      return;
    }
    let cancelled = false;
    fetchUserSounds(getAccessToken)
      .then((data) => !cancelled && setLibrary({ owner: email, status: 'ready', data }))
      .catch((error: unknown) => {
        if (!cancelled) {
          console.warn('Could not load your sounds', error);
          setLibrary({ owner: email, status: 'error' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [email, getAccessToken, reloads, signedIn]);

  const current = signedIn && library?.owner === email ? library : null;
  const status: UserSoundsStatus =
    accountStatus === 'loading'
      ? 'loading'
      : !signedIn
        ? 'signed-out'
        : (current?.status ?? 'loading');
  const sounds = useMemo(
    () => (current?.status === 'ready' ? (current.data?.sounds ?? []) : []),
    [current]
  );
  const definitions = useMemo(() => sounds.map(toDefinition), [sounds]);

  useEffect(() => {
    engine.setUploadedSounds(
      sounds.map((sound, index) => ({
        definition: definitions[index],
        resolveUri: () => userSoundFile(getAccessToken, sound),
      }))
    );
  }, [definitions, engine, getAccessToken, sounds]);

  // Change the list in place: refetching would empty it for a moment.
  const updateList = useCallback((change: (data: UserSoundsResponse) => UserSoundsResponse) => {
    setLibrary((state) =>
      state?.status === 'ready' && state.data ? { ...state, data: change(state.data) } : state
    );
  }, []);

  const upload = useCallback(
    async (file: PickedAudio, name: string, onProgress: (fraction: number) => void) => {
      const sound = await uploadUserSound(getAccessToken, file, name, onProgress);
      updateList((list) => ({
        sounds: [...list.sounds.filter((item) => item.id !== sound.id), sound],
        usage: {
          ...list.usage,
          count: list.usage.count + 1,
          bytes: list.usage.bytes + sound.sizeBytes,
        },
      }));
      return sound;
    },
    [getAccessToken, updateList]
  );

  const remove = useCallback(
    async (mixerId: string) => {
      const id = userSoundUuid(mixerId);
      const sound = sounds.find((item) => item.id === id);
      if (!id || !sound) {
        return;
      }
      await deleteUserSound(getAccessToken, id);
      forgetUserSoundFile(sound);
      updateList((list) => ({
        sounds: list.sounds.filter((item) => item.id !== id),
        usage: {
          ...list.usage,
          count: list.usage.count - 1,
          bytes: list.usage.bytes - sound.sizeBytes,
        },
      }));
    },
    [getAccessToken, sounds, updateList]
  );

  const retry = useCallback(() => {
    setLibrary(null);
    setReloads((count) => count + 1);
  }, []);

  return { status, definitions, usage: current?.data?.usage, upload, remove, retry };
}
