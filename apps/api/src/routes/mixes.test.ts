import request from 'supertest';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';

vi.mock('../lib/prisma', () => {
  return {
    prisma: {
      $transaction: vi.fn(),
      mix: {
        findUnique: vi.fn()
      }
    }
  };
});

const mockedPrisma = prisma as unknown as {
  $transaction: ReturnType<typeof vi.fn>;
  mix: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

const mockTimestamp = new Date('2025-01-01T00:00:00Z');

interface TransactionClient {
  sound: { createMany: ReturnType<typeof vi.fn> };
  mix: { create: ReturnType<typeof vi.fn> };
}

let mixCreateMock: ReturnType<typeof vi.fn>;
let soundCreateManyMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mixCreateMock = vi.fn().mockResolvedValue({
    id: 'mix-123',
    name: 'Gentle Focus',
    createdAt: mockTimestamp,
    masterVolume: 0.6,
    sounds: [
      {
        soundId: 'rain-shower',
        volume: 0.8
      }
    ]
  });

  soundCreateManyMock = vi.fn().mockResolvedValue({ count: 1 });

  mockedPrisma.$transaction.mockImplementation(async (callback: (tx: TransactionClient) => Promise<unknown>) => {
    return callback({
      sound: { createMany: soundCreateManyMock },
      mix: { create: mixCreateMock }
    });
  });

  mockedPrisma.$transaction.mockClear();
  mockedPrisma.mix.findUnique.mockReset();
});

describe('POST /api/mixes', () => {
  it('creates a shareable mix and returns it', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/mixes')
      .send({
        name: 'Gentle Focus',
        masterVolume: 0.6,
        sounds: [{ soundId: 'rain-shower', volume: 0.8 }]
      })
      .expect(201);

    expect(mockedPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(soundCreateManyMock).toHaveBeenCalledTimes(1);
    expect(soundCreateManyMock).toHaveBeenCalledWith({
      data: [expect.objectContaining({ id: 'rain-shower', name: 'Gentle Rain', fileUrl: null })],
      skipDuplicates: true
    });
    expect(mixCreateMock).toHaveBeenCalledWith({
      data: {
        name: 'Gentle Focus',
        masterVolume: 0.6,
        sounds: {
          create: [{ soundId: 'rain-shower', volume: 0.8 }]
        }
      },
      include: {
        sounds: {
          orderBy: { soundId: 'asc' }
        }
      }
    });
    expect(response.body).toEqual({
      id: 'mix-123',
      name: 'Gentle Focus',
      createdAt: mockTimestamp.toISOString(),
      masterVolume: 0.6,
      sounds: [{ soundId: 'rain-shower', volume: 0.8 }]
    });
  });

  it('rejects payloads that reuse the same sound', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/mixes')
      .send({
        masterVolume: 0.5,
        sounds: [
          { soundId: 'rain-shower', volume: 0.5 },
          { soundId: 'rain-shower', volume: 0.3 }
        ]
      })
      .expect(422);

    expect(response.body.message).toBe('Duplicate sounds are not allowed in a mix');
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects payloads with more sounds than the library has', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/mixes')
      .send({
        masterVolume: 0.5,
        sounds: Array.from({ length: 50 }, (_, index) => ({ soundId: `sound-${index}`, volume: 0.5 }))
      })
      .expect(422);

    expect(response.body.message).toBe('Invalid mix payload');
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not leak database errors to the client', async () => {
    mockedPrisma.$transaction.mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    const app = createApp();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await request(app)
      .post('/api/mixes')
      .send({ masterVolume: 0.5, sounds: [{ soundId: 'rain-shower', volume: 0.5 }] })
      .expect(500);

    expect(response.body).toEqual({ message: 'Internal Server Error' });
    consoleError.mockRestore();
  });

  it('rejects unknown sound identifiers', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/mixes')
      .send({
        masterVolume: 0.4,
        sounds: [{ soundId: 'unknown-sound', volume: 0.4 }]
      })
      .expect(400);

    expect(response.body.message).toContain('Unknown sounds');
  });
});

describe('GET /api/mixes/:id', () => {
  it('returns a previously shared mix', async () => {
    mockedPrisma.mix.findUnique.mockResolvedValue({
      id: 'mix-123',
      name: 'Gentle Focus',
      createdAt: mockTimestamp,
      masterVolume: 0.6,
      sounds: [
        { soundId: 'rain-shower', volume: 0.8 },
        { soundId: 'cozy-fireplace', volume: 0.4 }
      ]
    });

    const app = createApp();

    const response = await request(app).get('/api/mixes/mix-123').expect(200);

    expect(mockedPrisma.mix.findUnique).toHaveBeenCalledWith({
      where: { id: 'mix-123' },
      include: {
        sounds: {
          orderBy: { soundId: 'asc' }
        }
      }
    });

    expect(response.body).toEqual({
      id: 'mix-123',
      name: 'Gentle Focus',
      createdAt: mockTimestamp.toISOString(),
      masterVolume: 0.6,
      sounds: [
        { soundId: 'rain-shower', volume: 0.8 },
        { soundId: 'cozy-fireplace', volume: 0.4 }
      ]
    });
  });

  it('returns 404 when a mix cannot be found', async () => {
    mockedPrisma.mix.findUnique.mockResolvedValue(null);

    const app = createApp();

    await request(app).get('/api/mixes/missing').expect(404);
  });
});
