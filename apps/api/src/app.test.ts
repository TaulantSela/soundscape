import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from './app';

describe('API health check', () => {
  it('returns ok status', async () => {
    const app = createApp();
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok' });
  });
});
