import Slider from '@react-native-community/slider';
import {
  MAX_USER_SOUND_NAME_LENGTH,
  MAX_USER_SOUND_SECONDS,
  cleanUserSoundName,
  userSoundNameFromFile,
  type SoundDefinition,
  type UserSoundsResponse,
} from '@soundscape/audio-library';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { inspectPickedAudio, type PickedAudio } from './account/api';
import type { AccountStatus } from './account/use-account';
import type { UserSoundsStatus } from './account/use-user-sounds';
import type { LayerPosition } from './audio-engine';
import { PressableButton, Section, SoundRow, TextButton, colors } from './components';

const SKIP_SECONDS = 15;
const REFRESH_MS = 250;

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function formatMegabytes(bytes: number) {
  const value = bytes / (1024 * 1024);
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} MB`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

/** Position, scrubbing and skipping for an uploaded layer that's on. */
function UploadTransport({
  sound,
  getPosition,
  onSeek,
}: {
  sound: SoundDefinition;
  getPosition: (soundId: string) => LayerPosition | undefined;
  onSeek: (soundId: string, seconds: number) => void;
}) {
  const [now, setNow] = useState<LayerPosition | undefined>(undefined);
  const [scrub, setScrub] = useState<number | null>(null);

  useEffect(() => {
    const refresh = () => setNow(getPosition(sound.id));
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [getPosition, sound.id]);

  if (!now) {
    // Downloading the first time, then loading the player.
    return <Text style={styles.muted}>Loading…</Text>;
  }

  const seek = (seconds: number) => {
    onSeek(sound.id, seconds);
    setNow({ ...now, position: Math.min(Math.max(0, seconds), now.duration) });
  };
  const shown = scrub ?? now.position;

  return (
    <View style={styles.transport}>
      <Slider
        value={shown}
        minimumValue={0}
        maximumValue={now.duration}
        onValueChange={setScrub}
        onSlidingComplete={(value) => {
          setScrub(null);
          seek(value);
        }}
        accessibilityLabel={`${sound.name} position`}
        accessibilityValue={{ text: `${formatTime(shown)} of ${formatTime(now.duration)}` }}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor="#1e293b"
        thumbTintColor={colors.accent}
      />
      <View style={styles.transportRow}>
        <Text style={styles.time} testID={`${sound.name} time`}>
          {formatTime(shown)} / {formatTime(now.duration)}
        </Text>
        <View style={styles.transportButtons}>
          <TextButton
            label="Restart"
            accessibilityLabel={`Restart ${sound.name}`}
            onPress={() => seek(0)}
          />
          <TextButton
            label={`−${SKIP_SECONDS}s`}
            accessibilityLabel={`Back ${SKIP_SECONDS} seconds in ${sound.name}`}
            onPress={() => seek(now.position - SKIP_SECONDS)}
          />
          <TextButton
            label={`+${SKIP_SECONDS}s`}
            accessibilityLabel={`Forward ${SKIP_SECONDS} seconds in ${sound.name}`}
            onPress={() => seek(now.position + SKIP_SECONDS)}
          />
        </View>
      </View>
    </View>
  );
}

export interface YourSoundsProps {
  accountStatus: AccountStatus;
  email: string;
  onSignIn: () => Promise<boolean>;
  onSignOut: () => Promise<void>;
  status: UserSoundsStatus;
  sounds: SoundDefinition[];
  usage?: UserSoundsResponse['usage'];
  volumes: Record<string, number>;
  onToggle: (sound: SoundDefinition) => void;
  onVolumeChange: (soundId: string, volume: number) => void;
  onUpload: (
    file: PickedAudio,
    name: string,
    onProgress: (fraction: number) => void
  ) => Promise<unknown>;
  onDelete: (soundId: string) => Promise<void>;
  onRetry: () => void;
  getPosition: (soundId: string) => LayerPosition | undefined;
  onSeek: (soundId: string, seconds: number) => void;
}

/** The account's own uploads: sign in, play, upload and delete. */
export function YourSounds(props: YourSoundsProps) {
  const { accountStatus, email, status, sounds, usage, volumes } = props;
  const [signingIn, setSigningIn] = useState(false);
  const [checking, setChecking] = useState(false);
  const [draft, setDraft] = useState<{ file: PickedAudio; name: string } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const full = usage ? usage.count >= usage.maxCount || usage.bytes >= usage.maxBytes : false;
  const busy = checking || progress !== null;

  async function signIn() {
    setSigningIn(true);
    try {
      await props.onSignIn();
    } catch (error) {
      Alert.alert("Couldn't sign in", errorMessage(error));
    } finally {
      setSigningIn(false);
    }
  }

  function confirmSignOut() {
    Alert.alert(
      'Sign out?',
      'Your sounds stay in your account. This phone forgets its downloaded copies.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => props.onSignOut().catch(() => undefined),
        },
      ]
    );
  }

  async function pickFile() {
    setChecking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) {
        return;
      }
      const file = await inspectPickedAudio(asset);
      setDraft({ file, name: userSoundNameFromFile(asset.name) });
    } catch (error) {
      Alert.alert("Can't upload that file", errorMessage(error));
    } finally {
      setChecking(false);
    }
  }

  async function upload() {
    const name = draft ? cleanUserSoundName(draft.name) : undefined;
    if (!draft || !name) {
      return;
    }
    setProgress(0);
    try {
      await props.onUpload(draft.file, name, setProgress);
      setDraft(null);
    } catch (error) {
      Alert.alert('Upload failed', errorMessage(error));
    } finally {
      setProgress(null);
    }
  }

  function confirmDelete(sound: SoundDefinition) {
    Alert.alert(`Delete “${sound.name}”?`, 'It is removed from your account on every device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          props
            .onDelete(sound.id)
            .catch((error: unknown) => Alert.alert("Couldn't delete it", errorMessage(error)));
        },
      },
    ]);
  }

  return (
    <Section
      title="Your sounds"
      action={
        accountStatus === 'signed-in' ? (
          <TextButton label="Sign out" onPress={confirmSignOut} />
        ) : undefined
      }
    >
      {status === 'signed-out' ? (
        <View style={styles.card}>
          <Text style={styles.body}>
            Sign in to play your own recordings here and upload new ones. Only you can hear them.
          </Text>
          <PressableButton
            label={signingIn ? 'Opening…' : 'Sign in'}
            onPress={signIn}
            disabled={signingIn}
          />
        </View>
      ) : null}

      {status === 'loading' ? <Text style={styles.muted}>Loading your sounds…</Text> : null}

      {status === 'error' ? (
        <View style={styles.inline}>
          <Text style={styles.muted}>Your sounds couldn&apos;t be loaded.</Text>
          <TextButton label="Try again" onPress={props.onRetry} />
        </View>
      ) : null}

      {accountStatus === 'signed-in' && email ? (
        <Text style={styles.muted}>Signed in as {email}</Text>
      ) : null}

      {status === 'ready' && sounds.length === 0 && !draft ? (
        <Text style={styles.muted}>
          No sounds yet. Upload an MP3, M4A or WAV file of up to {MAX_USER_SOUND_SECONDS / 60}{' '}
          minutes.
        </Text>
      ) : null}

      {sounds.map((sound) => {
        const volume = volumes[sound.id] ?? 0;
        return (
          <SoundRow
            key={sound.id}
            sound={sound}
            volume={volume}
            onToggle={() => props.onToggle(sound)}
            onVolumeChange={(value) => props.onVolumeChange(sound.id, value)}
            onDelete={() => confirmDelete(sound)}
          >
            {volume > 0 ? (
              <UploadTransport
                sound={sound}
                getPosition={props.getPosition}
                onSeek={props.onSeek}
              />
            ) : null}
          </SoundRow>
        );
      })}

      {draft ? (
        <View style={styles.card}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={draft.name}
            onChangeText={(name) => setDraft({ ...draft, name })}
            maxLength={MAX_USER_SOUND_NAME_LENGTH}
            editable={progress === null}
            accessibilityLabel="Sound name"
            style={styles.input}
            placeholderTextColor={colors.faint}
          />
          <Text style={styles.muted}>
            {draft.file.name} · {formatMegabytes(draft.file.size)}
          </Text>
          <PressableButton
            label={progress === null ? 'Upload' : `Uploading… ${Math.round(progress * 100)}%`}
            onPress={upload}
            disabled={progress !== null || !cleanUserSoundName(draft.name)}
          />
          <TextButton label="Cancel" onPress={() => setDraft(null)} disabled={progress !== null} />
        </View>
      ) : null}

      {status === 'ready' && !draft ? (
        <PressableButton
          label={checking ? 'Checking the file…' : 'Upload a sound'}
          onPress={pickFile}
          disabled={busy || full}
        />
      ) : null}

      {usage ? (
        <Text style={styles.muted}>
          {usage.count} of {usage.maxCount} sounds · {formatMegabytes(usage.bytes)} of{' '}
          {formatMegabytes(usage.maxBytes)} used
          {full ? ' · Delete a sound to make room for more.' : ''}
        </Text>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  body: {
    fontSize: 15,
    color: colors.text,
  },
  muted: {
    fontSize: 13,
    color: colors.muted,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
  },
  transport: {
    gap: 4,
  },
  transportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transportButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  time: {
    fontSize: 12,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
  },
});
