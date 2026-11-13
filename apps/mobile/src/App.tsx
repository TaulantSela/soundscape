import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import {
  DEFAULT_ENABLE_VOLUME,
  DEFAULT_MASTER_VOLUME,
  applyPresetToMix,
  buildSharedMixPath,
  builtInPresets,
  clampVolume,
  createEmptyMix,
  hasActiveSounds,
  isUserSoundId,
  serializeMix,
  setMasterVolume,
  setSoundVolume,
  soundLibrary,
  toggleSound,
  type MixState,
  type PresetDefinition,
  type SoundDefinition,
} from '@soundscape/audio-library';
import { buildAppUrl } from '@soundscape/config';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { useAccount } from './account/use-account';
import { useUserSounds } from './account/use-user-sounds';
import { useMixerAudio } from './audio-engine';
import { PressableButton, Section, SoundRow } from './components';
import { appConfig } from './config';
import { YourSounds } from './your-sounds';

const STORAGE_KEY = 'soundscape.mobile.mixer';
const PERSIST_DELAY_MS = 400;

interface StoredMixerState {
  mix?: { gains?: Record<string, unknown>; masterVolume?: unknown };
  lastVolumes?: Record<string, unknown>;
  activePresetId?: unknown;
}

function toVolume(value: unknown) {
  return typeof value === 'number' ? clampVolume(value) : 0;
}

/** Saved volumes of uploaded sounds; their list arrives after the account loads. */
function userSoundVolumes(raw: Record<string, unknown> | undefined) {
  return Object.fromEntries(
    Object.entries(raw ?? {})
      .filter(([id]) => isUserSoundId(id))
      .map(([id, value]) => [id, toVolume(value)] as const)
      .filter(([, volume]) => volume > 0)
  );
}

/** Rebuild a saved mix against the current sound list. Playback always starts stopped. */
function restoreMix(stored: StoredMixerState, soundIds: string[]): MixState {
  const gains = Object.fromEntries(soundIds.map((id) => [id, toVolume(stored.mix?.gains?.[id])]));
  const masterVolume =
    typeof stored.mix?.masterVolume === 'number'
      ? clampVolume(stored.mix.masterVolume)
      : DEFAULT_MASTER_VOLUME;
  return { isPlaying: false, masterVolume, gains };
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Mixer />
    </SafeAreaProvider>
  );
}

function Mixer() {
  const soundIds = useMemo(() => soundLibrary.map((item) => item.id), []);
  const [mix, setMix] = useState<MixState>(() => createEmptyMix(soundIds, DEFAULT_MASTER_VOLUME));
  const [lastVolumes, setLastVolumes] = useState<Record<string, number>>({});
  const [activePresetId, setActivePresetId] = useState<string | undefined>();
  const [hydrated, setHydrated] = useState(false);
  const [isSharing, setSharing] = useState(false);
  // Saved volumes of uploads, waiting for the account's list.
  const pendingUserGains = useRef<Record<string, number>>({});

  const hasSounds = hasActiveSounds(mix);

  const handleExternalPlayingChange = useCallback((isPlaying: boolean) => {
    setMix((state) => ({ ...state, isPlaying: isPlaying && hasActiveSounds(state) }));
  }, []);

  const engine = useMixerAudio(soundLibrary, mix, handleExternalPlayingChange);
  const account = useAccount();
  const userSounds = useUserSounds(engine, account.status, account.email, account.getAccessToken);

  // Once the account's list is known: give its sounds their saved volumes,
  // and drop layers that are gone (deleted, or signed out).
  useEffect(() => {
    if (!hydrated || (userSounds.status !== 'ready' && userSounds.status !== 'signed-out')) {
      return;
    }
    const available = new Set(userSounds.definitions.map((sound) => sound.id));
    const pending = pendingUserGains.current;
    pendingUserGains.current = {};
    setMix((state) => {
      const gains: Record<string, number> = {};
      for (const [id, volume] of Object.entries(state.gains)) {
        if (!isUserSoundId(id) || available.has(id)) gains[id] = volume;
      }
      for (const id of available) {
        gains[id] = state.gains[id] ?? pending[id] ?? 0;
      }
      const next = { ...state, gains };
      return { ...next, isPlaying: next.isPlaying && hasActiveSounds(next) };
    });
  }, [hydrated, userSounds.definitions, userSounds.status]);

  useEffect(() => {
    const restore = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          return;
        }
        const stored = JSON.parse(raw) as StoredMixerState;
        setMix(restoreMix(stored, soundIds));
        pendingUserGains.current = userSoundVolumes(stored.mix?.gains);
        setLastVolumes({
          ...userSoundVolumes(stored.lastVolumes),
          ...Object.fromEntries(
            soundIds
              .map((id) => [id, toVolume(stored.lastVolumes?.[id])] as const)
              .filter(([, volume]) => volume > 0)
          ),
        });
        const presetId =
          typeof stored.activePresetId === 'string' ? stored.activePresetId : undefined;
        setActivePresetId(
          builtInPresets.some((preset) => preset.id === presetId) ? presetId : undefined
        );
      } catch (error) {
        console.warn('Failed to restore mixer state', error);
      } finally {
        setHydrated(true);
      }
    };

    void restore();
  }, [soundIds]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    // Sliders fire on every step; save once the user pauses.
    const timer = setTimeout(() => {
      const payload: StoredMixerState = {
        // Keep uploads' volumes that are still waiting for the account's list.
        mix: {
          gains: { ...pendingUserGains.current, ...mix.gains },
          masterVolume: mix.masterVolume,
        },
        lastVolumes,
        activePresetId,
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch((error: unknown) => {
        console.warn('Failed to persist mixer state', error);
      });
    }, PERSIST_DELAY_MS);

    return () => clearTimeout(timer);
  }, [activePresetId, hydrated, lastVolumes, mix.gains, mix.masterVolume]);

  const handleToggleSound = useCallback(
    (sound: SoundDefinition) => {
      setMix((state) => {
        const next = toggleSound(
          state,
          sound.id,
          lastVolumes[sound.id] ?? sound.defaultVolume ?? DEFAULT_ENABLE_VOLUME
        );
        const turnedOn = (next.gains[sound.id] ?? 0) > 0;
        // Switching a sound on starts playback; switching the last one off stops it.
        return { ...next, isPlaying: turnedOn || (state.isPlaying && hasActiveSounds(next)) };
      });
      setActivePresetId(undefined);
    },
    [lastVolumes]
  );

  const handleVolumeChange = useCallback((soundId: string, volume: number) => {
    setMix((state) => setSoundVolume(state, soundId, volume));
    if (volume > 0) {
      setLastVolumes((state) => ({ ...state, [soundId]: clampVolume(volume) }));
    }
    setActivePresetId(undefined);
  }, []);

  const handleMasterChange = useCallback((volume: number) => {
    setMix((state) => setMasterVolume(state, volume));
  }, []);

  const handleApplyPreset = useCallback((preset: PresetDefinition) => {
    setMix((state) => ({ ...applyPresetToMix(state, preset.mix), isPlaying: true }));
    setLastVolumes((state) => ({
      ...state,
      ...Object.fromEntries(preset.mix.map((item) => [item.soundId, item.volume])),
    }));
    setActivePresetId(preset.id);
  }, []);

  const handleTogglePlay = useCallback(() => {
    setMix((state) => ({ ...state, isPlaying: !state.isPlaying && hasActiveSounds(state) }));
  }, []);

  const handleShare = useCallback(async () => {
    const sounds = serializeMix(mix);
    if (sounds.length === 0) {
      Alert.alert('Nothing to share yet', 'Switch on at least one sound before sharing your mix.');
      return;
    }

    // The mix travels inside the link, so sharing works offline and needs no server.
    const url = buildAppUrl(
      appConfig,
      buildSharedMixPath({ sounds, masterVolume: mix.masterVolume })
    );
    try {
      setSharing(true);
      await Share.share({
        title: 'My Soundscape mix',
        message: `Check out my Soundscape mix: ${url}`,
        url,
      });
    } catch (error) {
      Alert.alert(
        'Share failed',
        error instanceof Error ? error.message : 'Unable to share the mix right now.'
      );
    } finally {
      setSharing(false);
    }
  }, [mix]);

  if (!hydrated) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingState}>
          <Text style={styles.loadingText}>Loading your mixer…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Soundscape Mixer</Text>
        <Text style={styles.subtitle}>
          Blend ambient layers to focus, relax, or sleep anywhere.
        </Text>

        <Section title="Presets">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetList}
          >
            {builtInPresets.map((preset) => (
              <PressableButton
                key={preset.id}
                label={preset.emoji ? `${preset.emoji} ${preset.name}` : preset.name}
                active={preset.id === activePresetId}
                onPress={() => handleApplyPreset(preset)}
              />
            ))}
          </ScrollView>
        </Section>

        <Section title="Sounds">
          {soundLibrary.map((sound) => (
            <SoundRow
              key={sound.id}
              sound={sound}
              volume={mix.gains[sound.id] ?? 0}
              onToggle={() => handleToggleSound(sound)}
              onVolumeChange={(value) => handleVolumeChange(sound.id, value)}
            />
          ))}
        </Section>

        <YourSounds
          accountStatus={account.status}
          email={account.email}
          onSignIn={account.signIn}
          onSignOut={account.signOut}
          status={userSounds.status}
          sounds={userSounds.definitions}
          usage={userSounds.usage}
          volumes={mix.gains}
          onToggle={handleToggleSound}
          onVolumeChange={handleVolumeChange}
          onUpload={userSounds.upload}
          onDelete={userSounds.remove}
          onRetry={userSounds.retry}
          getPosition={engine.getPosition}
          onSeek={engine.seek}
        />

        <Section title="Master volume">
          <View style={styles.masterRow}>
            <Slider
              value={mix.masterVolume}
              onValueChange={handleMasterChange}
              minimumValue={0}
              maximumValue={1}
              step={0.01}
              minimumTrackTintColor="#38bdf8"
              maximumTrackTintColor="#1e293b"
              thumbTintColor="#38bdf8"
              accessibilityLabel="Master volume"
            />
            <Text style={styles.masterValue}>{Math.round(mix.masterVolume * 100)}%</Text>
          </View>
        </Section>
      </ScrollView>

      <View style={styles.transport}>
        <View style={styles.transportButton}>
          <PressableButton
            label={mix.isPlaying ? 'Pause' : 'Play'}
            onPress={handleTogglePlay}
            disabled={!mix.isPlaying && !hasSounds}
          />
        </View>
        <View style={styles.transportButton}>
          <PressableButton
            label={isSharing ? 'Sharing…' : 'Share mix'}
            onPress={handleShare}
            disabled={isSharing || !hasSounds}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 24,
    gap: 24,
    paddingBottom: 120,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
  },
  masterRow: {
    backgroundColor: '#111c36',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  masterValue: {
    fontSize: 14,
    color: '#cbd5f5',
  },
  transport: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  transportButton: {
    flex: 1,
  },
  presetList: {
    gap: 12,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
  },
});
