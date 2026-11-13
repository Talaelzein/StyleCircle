import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('StyleCircle API baseline', () => {
  it('reports health without a database connection', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('requires a token to see the wardrobe', async () => {
    const response = await request(app).get('/api/clothing-items');
    expect(response.status).toBe(401);
  });

  it('requires a token to see the private profile', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
  });
});
