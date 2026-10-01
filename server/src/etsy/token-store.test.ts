import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, it } from 'node:test';
import { createApp } from '../app.ts';
import { openDb } from '../db.ts';
import { createEtsyClient, type EtsyFetch, EtsyError, withAuth } from './client.ts';
import { REFRESH_TOKEN_LIFETIME_MS } from './oauth.ts';
import type { Clock } from './throttle.ts';
import {
  countCallsLast24h,
  createAccessTokens,
  createSqliteTokenStore,
  NotConnectedError,
  REFRESH_EARLY_MS,
  REFRESH_WARNING_MS,
  type ShopConnection,
  shopStatus,
  type TokenStore,
} from './token-store.ts';

const NOW = 10_000_000_000;
const HOUR_MS = 60 * 60 * 1000;
const clock: Clock = { now: () => NOW, sleep: async () => {} };

const connected: ShopConnection = {
  etsyShopId: 777,
  etsyUserId: 42,
  name: 'Shirt Shop',
  accessToken: '42.old-access',
  refreshToken: '42.old-refresh',
  accessExpiresAt: NOW + HOUR_MS,
  refreshExpiresAt: NOW + 60 * 24 * HOUR_MS,
  scopes: 'listings_r listings_w shops_r',
  connectedAt: NOW - HOUR_MS,
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

// A fake Etsy with a token endpoint and getMe. getMe accepts the tokens `accept`
// allows (by default, the stored access token). Each refresh issues access-N / refresh-N and waits one macrotask, so
// concurrent callers really overlap the refresh.
function fakeEtsy(store: TokenStore, options: { accept?: (token: string) => boolean; tokenStatus?: number } = {}) {
  let issued = 0;
  const refreshes: URLSearchParams[] = [];
  const apiCalls: Array<{ bearer: string | null; storedAtCall: string | undefined }> = [];
  const fetch = async (url: string, init: RequestInit): Promise<Response> => {
    const { pathname } = new URL(url);
    if (pathname === '/v3/public/oauth/token') {
      refreshes.push(new URLSearchParams(String(init.body)));
      await new Promise((resolve) => setTimeout(resolve, 1));
      if (options.tokenStatus !== undefined) return json(options.tokenStatus, { error: 'invalid_grant' });
      issued++;
      return json(200, { access_token: `42.access-${issued}`, token_type: 'Bearer', expires_in: 3600, refresh_token: `42.refresh-${issued}` });
    }
    const bearer = new Headers(init.headers).get('authorization');
    apiCalls.push({ bearer, storedAtCall: store.get()?.accessToken });
    const token = bearer?.replace(/^Bearer /, '') ?? '';
    const ok = options.accept ? options.accept(token) : token === store.get()?.accessToken;
    return ok ? json(200, { user_id: 42, shop_id: 777 }) : json(401, { error: 'invalid_token' });
  };
  return { fetch, refreshes, apiCalls };
}

describe('access tokens', () => {
  let db: DatabaseSync;
  let store: TokenStore;

  beforeEach(() => {
    db = openDb(':memory:');
    store = createSqliteTokenStore(db);
  });

  function clients(etsy: ReturnType<typeof fakeEtsy>): { keyed: EtsyFetch; authed: EtsyFetch } {
    const keyed = createEtsyClient({ keystring: 'key123', sharedSecret: 'secret456', db, fetch: etsy.fetch, throttle: (task) => task(), clock });
    const tokens = createAccessTokens({ store, keystring: 'key123', etsyFetch: keyed, clock });
    return { keyed, authed: withAuth(keyed, tokens) };
  }

  it('reads back what it saved, and nothing before that', () => {
    assert.equal(store.get(), undefined);
    store.save(connected);
    assert.deepEqual(store.get(), connected);
  });

  it('uses a fresh access token as is', async () => {
    store.save(connected);
    const etsy = fakeEtsy(store);
    await clients(etsy).authed('/v3/application/users/me');
    assert.equal(etsy.refreshes.length, 0);
    assert.deepEqual(etsy.apiCalls.map((c) => c.bearer), ['Bearer 42.old-access']);
  });

  it('refreshes an expired token before use and stores the new pair', async () => {
    store.save({ ...connected, accessExpiresAt: NOW - 1 });
    const etsy = fakeEtsy(store);
    await clients(etsy).authed('/v3/application/users/me');

    const [form] = etsy.refreshes;
    assert.ok(form);
    assert.deepEqual(Object.fromEntries(form), { grant_type: 'refresh_token', client_id: 'key123', refresh_token: '42.old-refresh' });
    assert.deepEqual(store.get(), {
      ...connected,
      accessToken: '42.access-1',
      refreshToken: '42.refresh-1',
      accessExpiresAt: NOW + HOUR_MS,
      refreshExpiresAt: NOW + REFRESH_TOKEN_LIFETIME_MS,
    });
  });

  it('refreshes a token that is about to expire', async () => {
    store.save({ ...connected, accessExpiresAt: NOW + REFRESH_EARLY_MS });
    const etsy = fakeEtsy(store);
    await clients(etsy).authed('/v3/application/users/me');
    assert.equal(etsy.refreshes.length, 1);
  });

  it('saves the new tokens before any request uses them', async () => {
    store.save({ ...connected, accessExpiresAt: NOW - 1 });
    const etsy = fakeEtsy(store);
    await clients(etsy).authed('/v3/application/users/me');
    assert.deepEqual(etsy.apiCalls, [{ bearer: 'Bearer 42.access-1', storedAtCall: '42.access-1' }]);
  });

  it('runs exactly one refresh when two requests hit an expired token at once', async () => {
    store.save({ ...connected, accessExpiresAt: NOW - 1 });
    const etsy = fakeEtsy(store);
    const { authed } = clients(etsy);
    const results = await Promise.all([authed('/v3/application/users/me'), authed('/v3/application/users/me')]);
    assert.deepEqual(results.map((r) => r.status), [200, 200]);
    assert.equal(etsy.refreshes.length, 1);
    assert.deepEqual(etsy.apiCalls.map((c) => c.bearer), ['Bearer 42.access-1', 'Bearer 42.access-1']);
  });

  it('refreshes once and retries once when Etsy answers 401', async () => {
    store.save(connected); // not expired by the clock, but revoked on Etsy's side
    const etsy = fakeEtsy(store, { accept: (token) => token !== '42.old-access' });
    const res = await clients(etsy).authed('/v3/application/users/me');
    assert.equal(res.status, 200);
    assert.equal(etsy.refreshes.length, 1);
    assert.deepEqual(etsy.apiCalls.map((c) => c.bearer), ['Bearer 42.old-access', 'Bearer 42.access-1']);
  });

  it('gives up after one retry when the new token is rejected too', async () => {
    store.save(connected);
    const etsy = fakeEtsy(store, { accept: () => false });
    await assert.rejects(clients(etsy).authed('/v3/application/users/me'), (error: unknown) => error instanceof EtsyError && error.status === 401);
    assert.equal(etsy.refreshes.length, 1);
    assert.equal(etsy.apiCalls.length, 2);
  });

  it('runs one refresh when two requests get a 401 for the same token', async () => {
    store.save(connected);
    const etsy = fakeEtsy(store, { accept: (token) => token !== '42.old-access' });
    const { authed } = clients(etsy);
    const both = await Promise.all([authed('/v3/application/users/me'), authed('/v3/application/users/me')]);
    assert.deepEqual(both.map((r) => r.status), [200, 200]);
    assert.equal(etsy.refreshes.length, 1);
    assert.equal(etsy.apiCalls.length, 4);
  });

  it('asks to reconnect when the refresh token has expired, without calling Etsy', async () => {
    store.save({ ...connected, accessExpiresAt: NOW - 1, refreshExpiresAt: NOW });
    const etsy = fakeEtsy(store);
    await assert.rejects(clients(etsy).authed('/v3/application/users/me'), NotConnectedError);
    assert.equal(etsy.refreshes.length + etsy.apiCalls.length, 0);
  });

  it('reports that no shop is connected', async () => {
    const etsy = fakeEtsy(store);
    await assert.rejects(clients(etsy).authed('/v3/application/users/me'), NotConnectedError);
  });

  it('keeps the stored tokens when a refresh fails, and tries again next time', async () => {
    const expired = { ...connected, accessExpiresAt: NOW - 1 };
    store.save(expired);
    const etsy = fakeEtsy(store, { tokenStatus: 400 });
    const { authed } = clients(etsy);
    await assert.rejects(authed('/v3/application/users/me'), EtsyError);
    await assert.rejects(authed('/v3/application/users/me'), EtsyError);
    assert.equal(etsy.refreshes.length, 2);
    assert.deepEqual(store.get(), expired);
  });

  it('never writes a token into the call log', async () => {
    store.save({ ...connected, accessExpiresAt: NOW - 1 });
    await clients(fakeEtsy(store)).authed('/v3/application/users/me');
    const logged = JSON.stringify(db.prepare('SELECT * FROM etsy_calls').all());
    assert.ok(!logged.includes('access') && !logged.includes('refresh'));
  });
});

describe('shopStatus', () => {
  it('reports no connection', () => {
    assert.deepEqual(shopStatus(undefined, 3, NOW), { connected: false, callsLast24h: 3 });
  });

  it('shows the shop and expiries, and no tokens', () => {
    const status = shopStatus(connected, 12, NOW);
    assert.deepEqual(status, {
      connected: true,
      name: 'Shirt Shop',
      accessExpiresAt: connected.accessExpiresAt,
      refreshExpiresAt: connected.refreshExpiresAt,
      reconnectSoon: false,
      callsLast24h: 12,
    });
    assert.ok(!JSON.stringify(status).includes('42.old'));
  });

  it('warns from 14 days before the refresh token expires', () => {
    const justOutside = shopStatus({ ...connected, refreshExpiresAt: NOW + REFRESH_WARNING_MS + 1 }, 0, NOW);
    const atLimit = shopStatus({ ...connected, refreshExpiresAt: NOW + REFRESH_WARNING_MS }, 0, NOW);
    assert.ok(justOutside.connected && !justOutside.reconnectSoon);
    assert.ok(atLimit.connected && atLimit.reconnectSoon);
  });
});

describe('countCallsLast24h', () => {
  it('counts only calls inside the rolling 24 hours', () => {
    const db = openDb(':memory:');
    const insert = db.prepare("INSERT INTO etsy_calls (ts, method, path, status, ms) VALUES (?, 'GET', '/x', 200, 1)");
    for (const ts of [NOW - 24 * HOUR_MS, NOW - 24 * HOUR_MS + 1, NOW - 1, NOW]) insert.run(ts);
    assert.equal(countCallsLast24h(db, NOW), 3);
  });
});

describe('/api/shop', () => {
  it('serves the shop status as JSON', async () => {
    const app = createApp({ shopStatus: () => shopStatus(connected, 5, NOW) });
    const res = await app.request('http://localhost:3003/api/shop');
    assert.equal(res.status, 200);
    const body: unknown = await res.json();
    assert.deepEqual(body, { ...shopStatus(connected, 5, NOW) });
    assert.ok(!JSON.stringify(body).includes('42.old'));
  });

  it('is refused for a foreign origin', async () => {
    const app = createApp({ shopStatus: () => shopStatus(connected, 5, NOW) });
    const res = await app.request('http://localhost:3003/api/shop', { headers: { origin: 'https://evil.example' } });
    assert.equal(res.status, 403);
  });
});
