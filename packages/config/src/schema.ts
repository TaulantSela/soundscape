import { z } from 'zod';

export const environmentNameSchema = z.enum(['development', 'staging', 'production', 'test']);
export type EnvironmentName = z.infer<typeof environmentNameSchema>;

export const runtimeTargetSchema = z.enum(['server', 'web', 'mobile', 'desktop']);
export type RuntimeTarget = z.infer<typeof runtimeTargetSchema>;

export const appConfigSchema = z.object({
  environment: environmentNameSchema.default('development'),
  runtime: runtimeTargetSchema.default('server'),
  /** Public web app origin, used for share links and the desktop shell. */
  appUrl: z.url().optional(),
  /** REST API base. Only set in development or when an API is deployed. */
  apiBaseUrl: z.url().optional(),
  assetBaseUrl: z.url().optional(),
  cdnBucketUrl: z.url().optional(),
  build: z
    .object({
      revision: z.string().optional(),
      timestamp: z.string().optional()
    })
    .default({}),
  mix: z
    .object({
      defaultFadeMs: z.number().min(0).max(5000).default(200),
      defaultMasterVolume: z.number().min(0).max(1).default(0.8)
    })
    .default({ defaultFadeMs: 200, defaultMasterVolume: 0.8 }),
  auth: z
    .object({
      storageKey: z.string().default('soundscape.auth'),
      refreshIntervalMinutes: z.number().int().positive().default(15)
    })
    .default({ storageKey: 'soundscape.auth', refreshIntervalMinutes: 15 }),
  featureFlags: z.record(z.string(), z.boolean()).default({})
});

export type AppConfig = z.infer<typeof appConfigSchema>;
