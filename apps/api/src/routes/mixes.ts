import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { presetSoundSettingSchema, soundLibrary } from '@soundscape/audio-library';
import type { ApiError } from '../middleware/error-handler';
import { prisma } from '../lib/prisma';

const createMixSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  masterVolume: z.number().min(0).max(1),
  sounds: z
    .array(presetSoundSettingSchema)
    .min(1, 'Provide at least one sound to share')
    .max(soundLibrary.length, 'Too many sounds')
});

type CreateMixPayload = z.infer<typeof createMixSchema>;

const soundIndex = new Map(soundLibrary.map((sound) => [sound.id, sound]));

function mapMixResponse(mix: NonNullable<Awaited<ReturnType<typeof fetchMixById>>>) {
  return {
    id: mix.id,
    name: mix.name ?? undefined,
    createdAt: mix.createdAt.toISOString(),
    masterVolume: mix.masterVolume,
    sounds: mix.sounds.map((item) => ({
      soundId: item.soundId,
      volume: item.volume
    }))
  };
}

async function fetchMixById(id: string) {
  return prisma.mix.findUnique({
    where: { id },
    include: {
      sounds: {
        orderBy: { soundId: 'asc' }
      }
    }
  });
}

function createHttpError(status: number, message: string, details?: unknown) {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.details = details;
  return error;
}

function ensureUniqueSounds(payload: CreateMixPayload) {
  const ids = payload.sounds.map((sound) => sound.soundId);
  if (new Set(ids).size !== ids.length) {
    throw createHttpError(422, 'Duplicate sounds are not allowed in a mix');
  }
}

function assertKnownSounds(soundIds: string[]) {
  const missing = soundIds.filter((id) => !soundIndex.has(id));
  if (missing.length > 0) {
    throw createHttpError(400, `Unknown sounds: ${missing.join(', ')}`);
  }
}

export const mixesRouter = Router();

// Creating mixes writes to the database, so cap it per client.
const createMixLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });

mixesRouter.post('/', createMixLimiter, async (req, res, next) => {
  try {
    const payload = createMixSchema.parse(req.body);
    ensureUniqueSounds(payload);

    const soundIds = payload.sounds.map((item) => item.soundId);
    assertKnownSounds(soundIds);

    const mix = await prisma.$transaction(async (tx) => {
      // Mix rows reference Sound rows; make sure the ones used exist. One
      // insert that skips existing rows, instead of an upsert per sound.
      await tx.sound.createMany({
        data: soundIds.flatMap((soundId) => {
          const metadata = soundIndex.get(soundId);
          return metadata
            ? [
                {
                  id: soundId,
                  name: metadata.name,
                  category: metadata.category,
                  fileUrl: metadata.file?.path ?? null,
                  defaultGain: metadata.defaultVolume
                }
              ]
            : [];
        }),
        skipDuplicates: true
      });

      return tx.mix.create({
        data: {
          name: payload.name ?? null,
          masterVolume: payload.masterVolume,
          sounds: {
            create: payload.sounds.map((item) => ({
              soundId: item.soundId,
              volume: item.volume
            }))
          }
        },
        include: {
          sounds: {
            orderBy: { soundId: 'asc' }
          }
        }
      });
    });

    res.status(201).json(mapMixResponse(mix));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next({ status: 422, message: 'Invalid mix payload', details: z.flattenError(error) });
    }

    return next(error);
  }
});

mixesRouter.get('/:id', async (req, res, next) => {
  try {
    const mix = await fetchMixById(req.params.id);

    if (!mix) {
      return res.status(404).json({ message: 'Mix not found' });
    }

    return res.json(mapMixResponse(mix));
  } catch (error) {
    return next(error);
  }
});
