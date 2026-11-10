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
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { useMixerAudio } from './audio-engine';
import { appConfig } from './config';

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

  const hasSounds = hasActiveSounds(mix);

  const handleExternalPlayingChange = useCallback((isPlaying: boolean) => {
    setMix((state) => ({ ...state, isPlaying: isPlaying && hasActiveSounds(state) }));
  }, []);

  useMixerAudio(soundLibrary, mix, handleExternalPlayingChange);

  useEffect(() => {
    const restore = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          return;
        }
        const stored = JSON.parse(raw) as StoredMixerState;
        setMix(restoreMix(stored, soundIds));
        setLastVolumes(
          Object.fromEntries(
            soundIds
              .map((id) => [id, toVolume(stored.lastVolumes?.[id])] as const)
              .filter(([, volume]) => volume > 0)
          )
        );
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
        mix: { gains: mix.gains, masterVolume: mix.masterVolume },
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SoundRow({
  sound,
  volume,
  onToggle,
  onVolumeChange,
}: {
  sound: SoundDefinition;
  volume: number;
  onToggle: () => void;
  onVolumeChange: (value: number) => void;
}) {
  const isActive = volume > 0;
  return (
    <View style={styles.soundRow}>
      <View style={styles.soundInfo}>
        <View>
          <Text style={styles.soundName}>
            {sound.emoji ? `${sound.emoji} ` : ''}
            {sound.name}
          </Text>
          <Text style={styles.soundCategory}>{sound.category.toUpperCase()}</Text>
        </View>
        <Switch
          value={isActive}
          onValueChange={onToggle}
          accessibilityLabel={`${sound.name} on or off`}
          trackColor={{ true: '#38bdf8', false: '#1f2937' }}
          thumbColor={isActive ? '#e0f2fe' : '#94a3b8'}
        />
      </View>
      <Slider
        style={styles.soundSlider}
        value={volume}
        disabled={!isActive}
        onValueChange={onVolumeChange}
        minimumValue={0}
        maximumValue={1}
        step={0.01}
        accessibilityLabel={`${sound.name} volume`}
        minimumTrackTintColor={isActive ? '#38bdf8' : '#1f2937'}
        maximumTrackTintColor="#0f172a"
        thumbTintColor={isActive ? '#38bdf8' : '#1f2937'}
      />
    </View>
  );
}

function PressableButton({
  label,
  onPress,
  disabled,
  active,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(active) }}
      style={({ pressed }) => [
        styles.buttonWrapper,
        active ? styles.buttonWrapperActive : undefined,
        pressed ? styles.buttonWrapperPressed : undefined,
        disabled ? styles.buttonWrapperDisabled : undefined,
      ]}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
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
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cbd5f5',
  },
  soundRow: {
    backgroundColor: '#111c36',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  soundInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  soundName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  soundCategory: {
    fontSize: 10,
    letterSpacing: 1,
    color: '#64748b',
  },
  soundSlider: {
    width: '100%',
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
  buttonWrapper: {
    backgroundColor: '#1d4ed8',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: 'center',
  },
  buttonWrapperActive: {
    backgroundColor: '#2563eb',
    borderWidth: 1,
    borderColor: '#7dd3fc',
  },
  buttonWrapperPressed: {
    opacity: 0.85,
  },
  buttonWrapperDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    color: '#f8fafc',
    fontWeight: '600',
    fontSize: 15,
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
