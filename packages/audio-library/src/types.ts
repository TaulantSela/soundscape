import { z } from 'zod';

export const soundCategorySchema = z.enum(['nature', 'urban', 'home', 'tones']);
export type SoundCategory = z.infer<typeof soundCategorySchema>;

export const soundIdSchema = z.string().min(1);
export type SoundId = z.infer<typeof soundIdSchema>;

export const soundDefinitionSchema = z.object({
  id: soundIdSchema,
  name: z.string(),
  category: soundCategorySchema,
  emoji: z.string().emoji().optional(),
  color: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/).optional(),
  file: z.object({
    path: z.string(),
    format: z.enum(['mp3', 'ogg', 'wav']),
    loop: z.boolean().default(true),
    normalized: z.boolean().default(true)
  }),
  defaultVolume: z.number().min(0).max(1).default(0.6),
  description: z.string().optional(),
  order: z.number().int().nonnegative()
});
export type SoundDefinition = z.infer<typeof soundDefinitionSchema>;

export const presetSoundSettingSchema = z.object({
  soundId: soundIdSchema,
  volume: z.number().min(0).max(1)
});
export type PresetSoundSetting = z.infer<typeof presetSoundSettingSchema>;

export const presetDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string().emoji().optional(),
  color: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  mix: z.array(presetSoundSettingSchema)
});
export type PresetDefinition = z.infer<typeof presetDefinitionSchema>;

export const mixStateSchema = z.object({
  isPlaying: z.boolean(),
  masterVolume: z.number().min(0).max(1),
  gains: z.record(soundIdSchema, z.number().min(0).max(1))
});
export type MixState = z.infer<typeof mixStateSchema>;
