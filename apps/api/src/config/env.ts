import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('4000'),
  DATABASE_URL: z.url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  /** Comma-separated list of browser origins allowed to call the API. */
  FRONTEND_URL: z.string().optional(),
  /** Number of reverse proxies in front of the API (enables `trust proxy`). */
  TRUST_PROXY: z.string().regex(/^\d+$/).optional(),
  EMAIL_FROM: z.email().optional(),
  SMTP_URL: z.string().optional()
});

const envResult = envSchema.safeParse(process.env);

if (!envResult.success) {
  console.error('❌ Invalid environment configuration', z.flattenError(envResult.error).fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = envResult.data;
