import { useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { buildAssetUrl } from '@soundscape/config';
import type { MixState, SoundDefinition } from '@soundscape/audio-library';
import { appConfig } from './config';

export function useAudioEngine(sounds: SoundDefinition[], mix: MixState) {
  const soundRefs = useRef(new Map<string, Audio.Sound>());
  const previousGains = useRef<Record<string, number>>({});

  useEffect(() => {
    void Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false
    });
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const sync = async () => {
      for (const sound of sounds) {
        const currentGain = mix.gains[sound.id] ?? 0;
        const previousGain = previousGains.current[sound.id] ?? 0;
        const wasActive = previousGain > 0;
        const isActive = currentGain > 0;
        const existing = soundRefs.current.get(sound.id);

        if (!isActive && wasActive && existing) {
          try {
            await existing.stopAsync();
          } catch (error) {
            console.warn('Failed stopping sound', sound.id, error);
          }
          try {
            await existing.unloadAsync();
          } catch (error) {
            console.warn('Failed unloading sound', sound.id, error);
          }
          soundRefs.current.delete(sound.id);
        }

        if (isActive && !existing) {
          const source = { uri: buildAssetUrl(appConfig, sound.file.path) };
          try {
            const result = await Audio.Sound.createAsync(source, {
              volume: currentGain,
              isLooping: true,
              shouldPlay: true
            });
            if (!isCancelled) {
              soundRefs.current.set(sound.id, result.sound);
            } else {
              await result.sound.unloadAsync();
            }
          } catch (error) {
            console.error('Failed loading sound', sound.id, error);
          }
          continue;
        }

        if (isActive && existing) {
          try {
            await existing.setVolumeAsync(currentGain);
            const status = await existing.getStatusAsync();
            if (!('isPlaying' in status) || !status.isPlaying) {
              await existing.playAsync();
            }
          } catch (error) {
            console.warn('Failed updating sound', sound.id, error);
          }
        }
      }

      previousGains.current = { ...mix.gains };
    };

    void sync();

    return () => {
      isCancelled = true;
    };
  }, [mix, sounds]);

  useEffect(() => {
    return () => {
      soundRefs.current.forEach((instance) => {
        void instance.stopAsync().catch(() => undefined);
        void instance.unloadAsync().catch(() => undefined);
      });
      soundRefs.current.clear();
    };
  }, []);
}
