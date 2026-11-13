import Slider from '@react-native-community/slider';
import type { SoundDefinition } from '@soundscape/audio-library';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

export const colors = {
  background: '#0f172a',
  card: '#111c36',
  accent: '#38bdf8',
  text: '#e2e8f0',
  muted: '#94a3b8',
  faint: '#64748b',
  danger: '#fda4af',
};

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export function SoundRow({
  sound,
  volume,
  onToggle,
  onVolumeChange,
  onDelete,
  children,
}: {
  sound: SoundDefinition;
  volume: number;
  onToggle: () => void;
  onVolumeChange: (value: number) => void;
  /** Shown for the account's own uploads. */
  onDelete?: () => void;
  /** Extra controls under the name, such as an upload's position. */
  children?: ReactNode;
}) {
  const isActive = volume > 0;
  return (
    <View style={styles.soundRow}>
      <View style={styles.soundInfo}>
        <View style={styles.soundTitle}>
          <Text style={styles.soundName}>
            {sound.emoji ? `${sound.emoji} ` : ''}
            {sound.name}
          </Text>
          <Text style={styles.soundCategory}>
            {sound.category === 'mine' ? 'YOUR UPLOAD' : sound.category.toUpperCase()}
          </Text>
        </View>
        {onDelete ? (
          <TextButton
            label="Delete"
            accessibilityLabel={`Delete ${sound.name}`}
            onPress={onDelete}
            danger
          />
        ) : null}
        <Switch
          value={isActive}
          onValueChange={onToggle}
          accessibilityLabel={`${sound.name} on or off`}
          trackColor={{ true: colors.accent, false: '#1f2937' }}
          thumbColor={isActive ? '#e0f2fe' : colors.muted}
        />
      </View>
      {children}
      <Slider
        style={styles.soundSlider}
        value={volume}
        disabled={!isActive}
        onValueChange={onVolumeChange}
        minimumValue={0}
        maximumValue={1}
        step={0.01}
        accessibilityLabel={`${sound.name} volume`}
        minimumTrackTintColor={isActive ? colors.accent : '#1f2937'}
        maximumTrackTintColor={colors.background}
        thumbTintColor={isActive ? colors.accent : '#1f2937'}
      />
    </View>
  );
}

export function PressableButton({
  label,
  onPress,
  disabled,
  active,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
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

/** A small text-only button, for secondary actions. */
export function TextButton({
  label,
  onPress,
  disabled,
  danger,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      hitSlop={8}
      style={({ pressed }) => [
        styles.textButton,
        pressed || disabled ? styles.buttonWrapperPressed : undefined,
      ]}
    >
      <Text style={[styles.textButtonLabel, danger ? styles.textButtonDanger : undefined]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cbd5f5',
  },
  soundRow: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  soundInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  soundTitle: {
    flex: 1,
  },
  soundName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  soundCategory: {
    fontSize: 10,
    letterSpacing: 1,
    color: colors.faint,
  },
  soundSlider: {
    width: '100%',
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
    opacity: 0.6,
  },
  buttonWrapperDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    color: '#f8fafc',
    fontWeight: '600',
    fontSize: 15,
  },
  textButton: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  textButtonLabel: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '500',
  },
  textButtonDanger: {
    color: colors.danger,
  },
});
