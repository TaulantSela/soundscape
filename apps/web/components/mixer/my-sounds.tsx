'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  MAX_USER_SOUND_NAME_LENGTH,
  MAX_USER_SOUND_SECONDS,
  userSoundNameFromFile,
  type SoundDefinition,
  type UserSoundsResponse
} from '@soundscape/audio-library';
import { Button } from '@/components/ui/button';
import { SoundCard } from '@/components/mixer/sound-card';
import type { UserSoundsStatus } from '@/hooks/use-user-sounds';
import { AUDIO_FILE_ACCEPT, inspectAudioFile } from '@/lib/user-sounds-api';

interface MySoundsProps {
  status: UserSoundsStatus;
  sounds: SoundDefinition[];
  /** Sounds still downloading or decoding after being switched on. */
  loadingIds: ReadonlySet<string>;
  usage?: UserSoundsResponse['usage'];
  volumes: Record<string, number>;
  onToggle: (soundId: string) => void;
  onVolumeChange: (soundId: string, volume: number) => void;
  onUpload: (file: File, name: string, onProgress: (fraction: number) => void) => Promise<unknown>;
  onDelete: (soundId: string) => Promise<void>;
  onRetry: () => void;
}

const MAX_MINUTES = MAX_USER_SOUND_SECONDS / 60;

function formatMegabytes(bytes: number) {
  const value = bytes / (1024 * 1024);
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} MB`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function MySounds({ status, sounds, loadingIds, usage, volumes, onToggle, onVolumeChange, onUpload, onDelete, onRetry }: MySoundsProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<{ file: File; name: string } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);

  const full = usage ? usage.count >= usage.maxCount || usage.bytes >= usage.maxBytes : false;
  const busy = checking || progress !== null;

  async function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }
    setChecking(true);
    try {
      // Fail fast, before anything is uploaded.
      await inspectAudioFile(file);
      setDraft({ file, name: userSoundNameFromFile(file.name) });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setChecking(false);
      if (fileInput.current) {
        fileInput.current.value = '';
      }
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) {
      return;
    }
    setProgress(0);
    try {
      await onUpload(draft.file, draft.name, setProgress);
      toast.success(`Added “${draft.name.trim()}”. Switch it on to hear it.`);
      setDraft(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setProgress(null);
    }
  }

  async function handleDelete(sound: SoundDefinition) {
    if (!window.confirm(`Delete “${sound.name}”? This can't be undone.`)) {
      return;
    }
    try {
      await onDelete(sound.id);
      toast.success(`Deleted “${sound.name}”.`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <section aria-labelledby="my-sounds-title" className="rounded-3xl border border-surfaceRaised bg-surface/80 p-6 backdrop-blur">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="my-sounds-title" className="text-lg font-semibold text-slate-100">
            Your sounds
          </h2>
          <p className="text-sm text-textMuted">Upload your own recordings to mix in. Only you can hear them.</p>
        </div>
        {status === 'ready' ? (
          <div className="flex flex-col items-end gap-1">
            <Button
              type="button"
              size="sm"
              disabled={busy || full || draft !== null}
              onClick={() => fileInput.current?.click()}
            >
              {checking ? 'Checking file…' : 'Upload a sound'}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept={AUDIO_FILE_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
          </div>
        ) : null}
      </header>

      {status === 'signed-out' ? (
        <p className="text-sm text-textMuted">
          <Link href="/auth/login" className="text-accent hover:text-accentMuted">
            Sign in
          </Link>{' '}
          or{' '}
          <Link href="/auth/register" className="text-accent hover:text-accentMuted">
            create an account
          </Link>{' '}
          to add MP3, M4A or WAV files of up to {MAX_MINUTES} minutes.
        </p>
      ) : null}

      {status === 'loading' ? <p className="text-sm text-textMuted">Loading your sounds…</p> : null}

      {status === 'error' ? (
        <p className="text-sm text-textMuted">
          Your sounds couldn&apos;t be loaded.{' '}
          <button type="button" onClick={onRetry} className="text-accent hover:text-accentMuted">
            Try again
          </button>
        </p>
      ) : null}

      {draft ? (
        <form onSubmit={handleUpload} className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl bg-surfaceRaised p-4">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-2 text-sm text-slate-100">
            Name
            <input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              maxLength={MAX_USER_SOUND_NAME_LENGTH}
              required
              disabled={progress !== null}
              className="rounded-2xl border border-surfaceRaised bg-background/80 px-4 py-2 text-slate-100 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40"
            />
          </label>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={progress !== null || !draft.name.trim()}>
              {progress === null ? 'Upload' : `Uploading… ${Math.round(progress * 100)}%`}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={progress !== null} onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
          <p className="w-full text-xs text-textMuted">
            {draft.file.name} · {formatMegabytes(draft.file.size)}
          </p>
        </form>
      ) : null}

      {status === 'ready' && sounds.length === 0 && !draft ? (
        <p className="text-sm text-textMuted">
          No sounds yet. Upload an MP3, M4A or WAV file of up to {MAX_MINUTES} minutes.
        </p>
      ) : null}

      {sounds.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {sounds.map((sound) => (
            <SoundCard
              key={sound.id}
              sound={sound}
              volume={volumes[sound.id] ?? 0}
              isActive={(volumes[sound.id] ?? 0) > 0}
              isLoading={loadingIds.has(sound.id)}
              onToggle={() => onToggle(sound.id)}
              onVolumeChange={(value) => onVolumeChange(sound.id, value)}
              onDelete={() => void handleDelete(sound)}
            />
          ))}
        </div>
      ) : null}

      {usage ? (
        <p className="mt-4 text-xs text-textMuted">
          {usage.count} of {usage.maxCount} sounds · {formatMegabytes(usage.bytes)} of {formatMegabytes(usage.maxBytes)} used
          {full ? ' · Delete a sound to make room for more.' : ''}
        </p>
      ) : null}
    </section>
  );
}
