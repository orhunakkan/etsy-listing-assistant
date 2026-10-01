import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApp } from '../app.ts';
import { isLocalRequest } from './local-only.ts';

const options = { hosts: ['localhost:3003'], origins: ['http://localhost:3003'] };

describe('isLocalRequest', () => {
  it('accepts the app host with no Origin', () => {
    assert.equal(isLocalRequest('localhost:3003', undefined, options), true);
  });

  it('accepts the app host with the app origin, ignoring case', () => {
    assert.equal(isLocalRequest('LOCALHOST:3003', 'http://LocalHost:3003', options), true);
  });

  it('rejects a foreign host (DNS rebinding)', () => {
    assert.equal(isLocalRequest('evil.example:3003', undefined, options), false);
  });

  it('rejects the app host on another port', () => {
    assert.equal(isLocalRequest('localhost:3004', undefined, options), false);
  });

  it('rejects a foreign origin', () => {
    assert.equal(isLocalRequest('localhost:3003', 'https://evil.example', options), false);
  });

  it('rejects the literal "null" origin sent by sandboxed pages', () => {
    assert.equal(isLocalRequest('localhost:3003', 'null', options), false);
  });
});

describe('app', () => {
  const app = createApp();

  it('serves /api/health to the app itself', async () => {
    const res = await app.request('http://localhost:3003/api/health');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });

  it('accepts the Vite dev origin', async () => {
    const res = await app.request('http://localhost:3003/api/health', { headers: { origin: 'http://localhost:5173' } });
    assert.equal(res.status, 200);
  });

  it('returns 403 for a foreign origin', async () => {
    const res = await app.request('http://localhost:3003/api/health', { headers: { origin: 'https://evil.example' } });
    assert.equal(res.status, 403);
  });

  it('returns 403 for a foreign host', async () => {
    const res = await app.request('http://evil.example:3003/api/health');
    assert.equal(res.status, 403);
  });

  it('sets the security headers', async () => {
    const res = await app.request('http://localhost:3003/api/health');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('content-security-policy'), "default-src 'self'; img-src 'self' blob: data:");
    assert.equal(res.headers.get('strict-transport-security'), null);
  });
});
