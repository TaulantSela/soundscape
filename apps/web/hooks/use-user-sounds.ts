'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  toUserSoundId,
  userSoundUuid,
  type SoundDefinition,
  type UserSound,
  type UserSoundsResponse
} from '@soundscape/audio-library';
import { authClient } from '@/lib/auth/client';
import type { MixerAudioEngine } from '@/lib/mixer-audio-engine';
import { deleteUserSound, fetchUserSoundBytes, fetchUserSounds, uploadUserSound } from '@/lib/user-sounds-api';
import { useMixerStore } from '@/store/mixer-store';

export type UserSoundsStatus = 'signed-out' | 'loading' | 'ready' | 'error';

function toDefinition(sound: UserSound, index: number): SoundDefinition {
  return {
    id: toUserSoundId(sound.id),
    name: sound.name,
    category: 'mine',
    emoji: '🎙️',
    defaultVolume: 0.6,
    order: 1000 + index
  };
}

/**
 * The signed-in account's uploaded sounds: loads them, plays them through
 * the engine, and uploads or deletes them.
 */
export function useUserSounds(engine: MixerAudioEngine) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const userId = session?.user?.id;
  const hydrated = useMixerStore((state) => state.hydrated);
  const sessionVersion = useMixerStore((state) => state.sessionVersion);
  const setUserSounds = useMixerStore((state) => state.setUserSounds);

  // The last list fetched, and for whom. Status is derived below, so a list
  // that belongs to another account (or none) is never shown.
  const [library, setLibrary] = useState<{ userId: string; status: 'ready' | 'error'; data?: UserSoundsResponse } | null>(
    null
  );
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (sessionPending || !userId) {
      return;
    }
    let cancelled = false;
    fetchUserSounds()
      .then((data) => {
        if (!cancelled) {
          setLibrary({ userId, status: 'ready', data });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.warn('Could not load your sounds', error);
          setLibrary({ userId, status: 'error' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloads, sessionPending, userId]);

  const current = userId && library?.userId === userId ? library : null;
  const status: UserSoundsStatus = sessionPending ? 'loading' : !userId ? 'signed-out' : current ? current.status : 'loading';
  const data = current?.status === 'ready' ? current.data : undefined;
  const definitions = useMemo(() => (data?.sounds ?? []).map(toDefinition), [data]);

  useEffect(() => {
    engine.setUploadedSounds(
      definitions.map((definition) => ({
        definition,
        load: () => fetchUserSoundBytes(userSoundUuid(definition.id) ?? '')
      }))
    );
  }, [definitions, engine]);

  // Hand the list to the mixer once it is final for this session. While it
  // loads (or after an error), saved volumes for uploaded sounds stay pending.
  useEffect(() => {
    if (!hydrated || (status !== 'ready' && status !== 'signed-out')) {
      return;
    }
    setUserSounds(definitions);
  }, [definitions, hydrated, sessionVersion, setUserSounds, status]);

  // Change the cached list in place: refetching would empty it for a moment
  // and make the engine drop audio it already has.
  const updateList = useCallback((change: (data: UserSoundsResponse) => UserSoundsResponse) => {
    setLibrary((state) => (state?.status === 'ready' && state.data ? { ...state, data: change(state.data) } : state));
  }, []);

  const upload = useCallback(
    async (file: File, name: string, onProgress?: (fraction: number) => void) => {
      const sound = await uploadUserSound(file, name, onProgress);
      updateList((list) => ({
        sounds: [...list.sounds.filter((item) => item.id !== sound.id), sound],
        usage: { ...list.usage, count: list.usage.count + 1, bytes: list.usage.bytes + sound.sizeBytes }
      }));
      return sound;
    },
    [updateList]
  );

  const remove = useCallback(
    async (mixerId: string) => {
      const id = userSoundUuid(mixerId);
      if (!id) {
        return;
      }
      await deleteUserSound(id);
      updateList((list) => {
        const removed = list.sounds.find((sound) => sound.id === id);
        return {
          sounds: list.sounds.filter((sound) => sound.id !== id),
          usage: removed
            ? { ...list.usage, count: list.usage.count - 1, bytes: list.usage.bytes - removed.sizeBytes }
            : list.usage
        };
      });
    },
    [updateList]
  );

  const retry = useCallback(() => {
    setLibrary(null);
    setReloads((count) => count + 1);
  }, []);

  return {
    status,
    signedIn: Boolean(userId),
    email: session?.user?.email,
    definitions,
    usage: data?.usage,
    upload,
    remove,
    retry
  };
}
