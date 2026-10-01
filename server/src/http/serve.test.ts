import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';
import { serve, type FetchHandler } from './serve.ts';

const handler: FetchHandler = async (request) => {
  const url = new URL(request.url);
  switch (url.pathname) {
    case '/echo':
      return Response.json({
        method: request.method,
        host: url.host,
        accept: request.headers.get('accept'),
        body: request.body ? await request.text() : null,
      });
    case '/cookies': {
      const headers = new Headers();
      headers.append('set-cookie', 'a=1; Path=/');
      headers.append('set-cookie', 'b=2; Path=/');
      return new Response(null, { status: 204, headers });
    }
    case '/throw':
      throw new Error('boom');
    default:
      return new Response('not found', { status: 404 });
  }
};

describe('serve', () => {
  let server: Server;
  let base = '';

  before(async () => {
    server = serve(handler, '127.0.0.1', 0);
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    base = `http://127.0.0.1:${address.port}`;
  });

  after(() => {
    server.close();
  });

  it('passes method, host and headers through on GET', async () => {
    const res = await fetch(`${base}/echo`, { headers: { accept: 'application/json' } });
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(res.status, 200);
    assert.equal(body['method'], 'GET');
    assert.equal(body['host'], new URL(base).host);
    assert.equal(body['accept'], 'application/json');
    assert.equal(body['body'], null);
  });

  it('streams a POST body to the handler', async () => {
    const res = await fetch(`${base}/echo`, { method: 'POST', body: 'hello' });
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(body['method'], 'POST');
    assert.equal(body['body'], 'hello');
  });

  it('sends multiple Set-Cookie headers separately', async () => {
    const res = await fetch(`${base}/cookies`);
    assert.equal(res.status, 204);
    assert.deepEqual(res.headers.getSetCookie(), ['a=1; Path=/', 'b=2; Path=/']);
  });

  it('returns a generic 500 when the handler throws, without leaking the error', async () => {
    const res = await fetch(`${base}/throw`);
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { error: 'internal error' });
  });

  it('keeps the status of a normal response', async () => {
    const res = await fetch(`${base}/missing`);
    assert.equal(res.status, 404);
    assert.equal(await res.text(), 'not found');
  });
});
