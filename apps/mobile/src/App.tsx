import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import {
  DEFAULT_MASTER_VOLUME,
  applyPresetToMix,
  clampVolume,
  createEmptyMix,
  serializeMix,
  setMasterVolume,
  setSoundVolume,
  toggleSound,
  type MixState,
  type PresetDefinition,
  type SoundDefinition
} from '@soundscape/audio-library';
import { builtInPresets, soundLibrary } from '@soundscape/audio-library';
import { apiClient } from './api-client';
import { buildAppUrl } from '@soundscape/config';
import { appConfig } from './config';
import { useAudioEngine } from './audio-engine';

const STORAGE_KEY = 'soundscape.mobile.mixer';

interface StoredMixerState {
  mix: MixState;
  activePresetId?: string;
}

export default function App() {
  const soundIds = useMemo(() => soundLibrary.map((item) => item.id), []);
  const [mix, setMix] = useState<MixState>(() => createEmptyMix(soundIds, DEFAULT_MASTER_VOLUME));
  const [activePresetId, setActivePresetId] = useState<string | undefined>();
  const [hydrated, setHydrated] = useState(false);
  const [isSharing, setSharing] = useState(false);

  const shareable = useMemo(() => serializeMix(mix).length > 0, [mix]);

  useAudioEngine(soundLibrary, mix);

  useEffect(() => {
    const restore = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          return;
        }
        const parsed = JSON.parse(raw) as StoredMixerState;
        const aligned = ensureMixAlignment(parsed.mix, soundIds);
        setMix(aligned);
        setActivePresetId(parsed.activePresetId);
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

    const persist = async () => {
      try {
        const payload: StoredMixerState = { mix, activePresetId };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (error) {
        console.warn('Failed to persist mixer state', error);
      }
    };

    void persist();
  }, [activePresetId, hydrated, mix]);

  const handleToggleSound = useCallback((soundId: string) => {
    setMix((state) => toggleSound(state, soundId));
    setActivePresetId(undefined);
  }, []);

  const handleVolumeChange = useCallback((soundId: string, volume: number) => {
    setMix((state) => setSoundVolume(state, soundId, volume));
    setActivePresetId(undefined);
  }, []);

  const handleMasterChange = useCallback((volume: number) => {
    setMix((state) => setMasterVolume(state, volume));
  }, []);

  const handleApplyPreset = useCallback((preset: PresetDefinition) => {
    setMix((state) => applyPresetToMix(state, preset.mix));
    setActivePresetId(preset.id);
  }, []);

  const handleShare = useCallback(async () => {
    const sounds = serializeMix(mix);

    if (sounds.length === 0) {
      Alert.alert('Nothing to share yet', 'Enable at least one sound before sharing your mix.');
      return;
    }

    try {
      setSharing(true);
      const response = await apiClient.createMix({
        sounds,
        masterVolume: mix.masterVolume
      });
      const url = buildAppUrl(appConfig, `/mix/${response.id}`);
      await Share.share({
        title: 'Check out my Soundscape mix',
        message: `Check out my Soundscape mix: ${url}`
      });
    } catch (error) {
      Alert.alert('Share failed', (error as Error).message ?? 'Unable to share mix right now.');
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
        <Text style={styles.subtitle}>Blend ambient layers to focus, relax, or sleep anywhere.</Text>

        <Section title="Presets">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetList}>
            {builtInPresets.map((preset) => (
              <PresetPill
                key={preset.id}
                preset={preset}
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
              onToggle={() => handleToggleSound(sound.id)}
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
            />
            <Text style={styles.masterValue}>{Math.round(mix.masterVolume * 100)}%</Text>
          </View>
        </Section>

        <PressableButton
          label={isSharing ? 'Sharing…' : 'Share mix'}
          onPress={handleShare}
          disabled={isSharing || !shareable}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function ensureMixAlignment(state: MixState, soundIds: string[]): MixState {
  const gains = soundIds.reduce<Record<string, number>>((acc, id) => {
    acc[id] = clampVolume(state.gains[id] ?? 0);
    return acc;
  }, {});

  return {
    ...state,
    gains
  };
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
  onVolumeChange
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
        <Text style={styles.soundName}>{sound.emoji ? `${sound.emoji} ` : ''}{sound.name}</Text>
        <Text style={styles.soundCategory}>{sound.category.toUpperCase()}</Text>
      </View>
      <Switch value={isActive} onValueChange={onToggle} trackColor={{ true: '#38bdf8', false: '#1f2937' }} thumbColor={isActive ? '#38bdf8' : '#111827'} />
      <Slider
        style={styles.soundSlider}
        value={volume}
        disabled={!isActive}
        onValueChange={onVolumeChange}
        minimumValue={0}
        maximumValue={1}
        step={0.01}
        minimumTrackTintColor={isActive ? '#38bdf8' : '#1f2937'}
        maximumTrackTintColor="#0f172a"
        thumbTintColor={isActive ? '#38bdf8' : '#1f2937'}
      />
    </View>
  );
}

function PresetPill({
  preset,
  active,
  onPress
}: {
  preset: PresetDefinition;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <PressableButton
      label={preset.emoji ? `${preset.emoji} ${preset.name}` : preset.name}
      onPress={onPress}
      active={active}
    />
  );
}

function PressableButton({
  label,
  onPress,
  disabled,
  active
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.buttonWrapper,
        active ? styles.buttonWrapperActive : undefined,
        pressed ? styles.buttonWrapperPressed : undefined,
        disabled ? styles.buttonWrapperDisabled : undefined
      ]}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  content: {
    padding: 24,
    gap: 24
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f1f5f9'
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8'
  },
  section: {
    gap: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cbd5f5'
  },
  soundRow: {
    backgroundColor: '#111c36',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12
  },
  soundInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  soundName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0'
  },
  soundCategory: {
    fontSize: 10,
    letterSpacing: 1,
    color: '#64748b'
  },
  soundSlider: {
    width: '100%'
  },
  masterRow: {
    backgroundColor: '#111c36',
    borderRadius: 16,
    padding: 16,
    gap: 12
  },
  masterValue: {
    fontSize: 14,
    color: '#cbd5f5'
  },
  buttonWrapper: {
    backgroundColor: '#1d4ed8',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center'
  },
  buttonWrapperActive: {
    backgroundColor: '#2563eb'
  },
  buttonWrapperPressed: {
    opacity: 0.85
  },
  buttonWrapperDisabled: {
    opacity: 0.5
  },
  buttonLabel: {
    color: '#f8fafc',
    fontWeight: '600',
    fontSize: 15
  },
  presetList: {
    gap: 12
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    color: '#94a3b8'
  }
});
