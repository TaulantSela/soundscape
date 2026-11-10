import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app';

vi.mock('./lib/prisma', () => ({ prisma: {} }));

describe('API health check', () => {
  it('returns ok status', async () => {
    const response = await request(createApp()).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok' });
  });
});

describe('CORS', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows configured origins only', async () => {
    const app = createApp({ corsOrigins: ['https://soundscape.example'] });

    const allowed = await request(app).get('/api/health').set('Origin', 'https://soundscape.example');
    expect(allowed.headers['access-control-allow-origin']).toBe('https://soundscape.example');

    const blocked = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows localhost outside production, but not in production', async () => {
    const devApp = createApp({ corsOrigins: [] });
    const dev = await request(devApp).get('/api/health').set('Origin', 'http://localhost:3000');
    expect(dev.headers['access-control-allow-origin']).toBe('http://localhost:3000');

    vi.stubEnv('NODE_ENV', 'production');
    const prodApp = createApp({ corsOrigins: [] });
    const prod = await request(prodApp).get('/api/health').set('Origin', 'http://localhost:3000');
    expect(prod.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('error handling', () => {
  it('reports malformed JSON as a client error', async () => {
    const response = await request(createApp())
      .post('/api/mixes')
      .set('Content-Type', 'application/json')
      .send('{"masterVolume":');
    expect(response.status).toBe(400);
  });
});
