import { Router } from 'express';
import { z } from 'zod';
import { presetSoundSettingSchema, soundLibrary } from '@soundscape/audio-library';
import type { ApiError } from '../middleware/error-handler';
import { prisma } from '../lib/prisma';

const createMixSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  masterVolume: z.number().min(0).max(1),
  sounds: z.array(presetSoundSettingSchema).min(1, 'Provide at least one sound to share')
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

mixesRouter.post('/', async (req, res, next) => {
  try {
    const payload = createMixSchema.parse(req.body);
    ensureUniqueSounds(payload);

    const soundIds = payload.sounds.map((item) => item.soundId);
    assertKnownSounds(soundIds);

    const mix = await prisma.$transaction(async (tx) => {
      for (const soundId of new Set(soundIds)) {
        const metadata = soundIndex.get(soundId);
        if (!metadata) {
          continue;
        }

        await tx.sound.upsert({
          where: { id: soundId },
          update: {
            name: metadata.name,
            category: metadata.category,
            fileUrl: metadata.file.path,
            defaultGain: metadata.defaultVolume
          },
          create: {
            id: soundId,
            name: metadata.name,
            category: metadata.category,
            fileUrl: metadata.file.path,
            defaultGain: metadata.defaultVolume
          }
        });
      }

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
      return next({ status: 422, message: 'Invalid mix payload', details: error.flatten() });
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
