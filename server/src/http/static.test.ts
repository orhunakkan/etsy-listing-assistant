import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { before, describe, it } from 'node:test';
import { createApp } from '../app.ts';

const BASE = 'http://localhost:3003';

describe('serving the built client', () => {
  let root: string;
  before(() => {
    root = mkdtempSync(join(tmpdir(), 'ela-static-'));
    const dist = join(root, 'dist');
    mkdirSync(join(dist, 'assets'), { recursive: true });
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>app</title>');
    writeFileSync(join(dist, 'assets', 'app.js'), 'console.log(1)');
    writeFileSync(join(root, 'secret.txt'), 'outside dist');
  });
  const app = () => createApp({ clientDir: join(root, 'dist') });

  it('serves files with their content type and the security headers', async () => {
    const res = await app().request(`${BASE}/assets/app.js`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /javascript/);
    assert.equal(await res.text(), 'console.log(1)');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.match(res.headers.get('content-security-policy') ?? '', /default-src 'self'/);
  });

  it('serves index.html at / and for client-side pages', async () => {
    for (const path of ['/', '/settings', '/batches/3']) {
      const res = await app().request(`${BASE}${path}`);
      assert.equal(res.status, 200, path);
      assert.match(await res.text(), /<title>app<\/title>/, path);
    }
  });

  it('never answers API or OAuth paths with the app', async () => {
    for (const path of ['/api/nope', '/oauth/nope', '/api']) {
      assert.equal((await app().request(`${BASE}${path}`)).status, 404, path);
    }
    assert.equal((await app().request(`${BASE}/api/health`)).status, 200);
  });

  it('does not serve files outside dist', async () => {
    for (const path of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2fsecret.txt', '/assets/..%5c..%5csecret.txt']) {
      const res = await app().request(`${BASE}${path}`);
      assert.doesNotMatch(await res.text(), /outside dist/, path);
    }
  });

  it('is off when no client directory is given', async () => {
    assert.equal((await createApp().request(`${BASE}/`)).status, 404);
  });
});
