import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, it } from 'node:test';
import { openDb } from '../db.ts';
import { createEtsyClient, type EtsyClientOptions, EtsyError, type Fetch, MAX_RETRIES } from './client.ts';
import type { Clock, Throttle } from './throttle.ts';

type Sent = { url: string; init: RequestInit };

// Replies with the given responses in order and records each request.
function fakeFetch(...responses: Array<Response | Error>): Fetch & { sent: Sent[] } {
  const sent: Sent[] = [];
  const fn = async (url: string, init: RequestInit): Promise<Response> => {
    sent.push({ url, init });
    const next = responses.shift();
    if (next === undefined) throw new Error('fakeFetch: no response left');
    if (next instanceof Error) throw next;
    return next;
  };
  return Object.assign(fn, { sent });
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

const clock: Clock & { sleeps: number[] } = { sleeps: [], now: () => 1_000_000, sleep: async (ms) => void clock.sleeps.push(ms) };
const noThrottle: Throttle = (task) => task();

function calls(db: DatabaseSync) {
  // node:sqlite rows have a null prototype; spread them so deepEqual compares plain objects.
  return db
    .prepare('SELECT ts, method, path, status, ms, remaining_today FROM etsy_calls ORDER BY rowid')
    .all()
    .map((row) => ({ ...row }));
}

describe('createEtsyClient', () => {
  let db: DatabaseSync;
  const options = (fetch: Fetch, extra: Partial<EtsyClientOptions> = {}): EtsyClientOptions => ({
    keystring: 'key123',
    sharedSecret: 'secret456',
    db,
    fetch,
    throttle: noThrottle,
    clock,
    ...extra,
  });

  beforeEach(() => {
    db = openDb(':memory:');
    clock.sleeps.length = 0;
  });

  it('sends x-api-key as keystring:secret to api.etsy.com, keeping caller headers', async () => {
    const fetch = fakeFetch(json(200, { application_id: 7 }));
    const etsyFetch = createEtsyClient(options(fetch));
    const res = await etsyFetch('/v3/application/openapi-ping', { headers: { accept: 'application/json' } });
    assert.deepEqual(await res.json(), { application_id: 7 });
    const [request] = fetch.sent;
    assert.ok(request);
    assert.equal(request.url, 'https://api.etsy.com/v3/application/openapi-ping');
    const headers = new Headers(request.init.headers);
    assert.equal(headers.get('x-api-key'), 'key123:secret456');
    assert.equal(headers.get('accept'), 'application/json');
  });

  it('refuses a path that points at another host, so the key never leaves Etsy', async () => {
    const fetch = fakeFetch();
    const etsyFetch = createEtsyClient(options(fetch));
    await assert.rejects(etsyFetch('https://evil.example/steal'), /not an Etsy API path/);
    await assert.rejects(etsyFetch('//evil.example/steal'), /not an Etsy API path/);
    assert.equal(fetch.sent.length, 0);
  });

  it('logs each call with method, path without query, status and remaining_today', async () => {
    const fetch = fakeFetch(json(200, {}, { 'x-remaining-today': '4321' }));
    await createEtsyClient(options(fetch))('/v3/application/shops/1/listings?state=draft', { method: 'post' });
    assert.deepEqual(calls(db), [
      { ts: 1_000_000, method: 'POST', path: '/v3/application/shops/1/listings', status: 200, ms: 0, remaining_today: 4321 },
    ]);
  });

  it('retries a 429 after the retry-after delay and logs both attempts', async () => {
    const fetch = fakeFetch(json(429, { error: 'slow down' }, { 'retry-after': '3' }), json(200, { ok: true }));
    const res = await createEtsyClient(options(fetch))('/v3/application/openapi-ping');
    assert.equal(res.status, 200);
    assert.deepEqual(clock.sleeps, [3000]);
    assert.deepEqual(
      calls(db).map((row) => row['status']),
      [429, 200],
    );
  });

  it('backs off exponentially and gives up with an EtsyError after the last retry', async () => {
    const tooMany = Array.from({ length: MAX_RETRIES + 1 }, () => json(429, { error: 'slow down' }));
    const fetch = fakeFetch(...tooMany);
    await assert.rejects(createEtsyClient(options(fetch))('/v3/application/openapi-ping'), (error) => {
      assert.ok(error instanceof EtsyError);
      assert.equal(error.status, 429);
      return true;
    });
    assert.deepEqual(clock.sleeps, [1000, 2000, 4000, 8000]);
    assert.equal(fetch.sent.length, MAX_RETRIES + 1);
  });

  it('sends every attempt through the throttle', async () => {
    let throttled = 0;
    const counting: Throttle = (task) => {
      throttled++;
      return task();
    };
    const fetch = fakeFetch(json(429, {}), json(200, {}));
    await createEtsyClient(options(fetch, { throttle: counting }))('/v3/application/openapi-ping');
    assert.equal(throttled, 2);
  });

  it("throws an EtsyError with Etsy's message on other errors, without retrying", async () => {
    const fetch = fakeFetch(json(400, { error: 'Invalid taxonomy_id' }));
    await assert.rejects(createEtsyClient(options(fetch))('/v3/application/listings'), (error) => {
      assert.ok(error instanceof EtsyError);
      assert.equal(error.status, 400);
      assert.equal(error.path, '/v3/application/listings');
      assert.match(error.message, /HTTP 400: Invalid taxonomy_id/);
      return true;
    });
    assert.equal(fetch.sent.length, 1);
  });

  it('keeps a non-JSON error body short', async () => {
    const fetch = fakeFetch(new Response('x'.repeat(2000), { status: 500 }));
    await assert.rejects(createEtsyClient(options(fetch))('/v3/application/openapi-ping'), (error) => {
      assert.ok(error instanceof EtsyError);
      assert.ok(error.message.length < 600);
      return true;
    });
  });

  it('logs a network failure with no status and rethrows it', async () => {
    const fetch = fakeFetch(new TypeError('fetch failed'));
    await assert.rejects(createEtsyClient(options(fetch))('/v3/application/openapi-ping'), /fetch failed/);
    assert.equal(calls(db)[0]?.['status'], null);
  });

  it('prunes logged calls older than 30 days', async () => {
    const day = 24 * 60 * 60 * 1000;
    const insert = db.prepare("INSERT INTO etsy_calls (ts, method, path, status, ms) VALUES (?, 'GET', '/old', 200, 1)");
    insert.run(1_000_000 - 31 * day);
    insert.run(1_000_000 - 29 * day);
    await createEtsyClient(options(fakeFetch(json(200, {}))))('/v3/application/openapi-ping');
    assert.deepEqual(
      calls(db).map((row) => row['ts']),
      [1_000_000 - 29 * day, 1_000_000],
    );
  });
});
