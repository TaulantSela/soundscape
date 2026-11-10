import { z } from 'zod';

export const soundCategorySchema = z.enum(['nature', 'urban', 'home', 'tones']);
export type SoundCategory = z.infer<typeof soundCategorySchema>;

export const soundIdSchema = z.string().min(1);
export type SoundId = z.infer<typeof soundIdSchema>;

const hexColorSchema = z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/);

/**
 * A recorded loop for a sound. Sounds without a file are synthesized on the
 * device (see `renderSound`), so a recording can be dropped in later without
 * touching the clients.
 */
export const soundFileSchema = z.object({
  path: z.string().min(1),
  format: z.enum(['mp3', 'ogg', 'wav', 'm4a'])
});
export type SoundFile = z.infer<typeof soundFileSchema>;

export const soundDefinitionSchema = z.object({
  id: soundIdSchema,
  name: z.string(),
  category: soundCategorySchema,
  emoji: z.emoji().optional(),
  color: hexColorSchema.optional(),
  file: soundFileSchema.optional(),
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
  emoji: z.emoji().optional(),
  color: hexColorSchema.optional(),
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
