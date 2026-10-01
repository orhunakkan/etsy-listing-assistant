import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, it } from 'node:test';
import { createApp } from '../app.ts';
import { openDb } from '../db.ts';
import { createEtsyClient, EtsyError } from './client.ts';
import {
  buildAuthorizeUrl,
  createOAuthFlow,
  createPkcePair,
  createStateStore,
  OAuthError,
  type OAuthFlow,
  parseTokenResponse,
  pkceChallenge,
  REFRESH_TOKEN_LIFETIME_MS,
  STATE_TTL_MS,
} from './oauth.ts';
import type { Clock } from './throttle.ts';
import { createSqliteTokenStore, type TokenStore } from './token-store.ts';

const REDIRECT_URI = 'http://localhost:3003/oauth/redirect';

function testClock(start = 1_000_000): Clock & { advance: (ms: number) => void } {
  let now = start;
  return { now: () => now, sleep: async () => {}, advance: (ms) => void (now += ms) };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

type Sent = { url: string; init: RequestInit };

// A fake Etsy: the token endpoint, getMe and getShop, answering for the given shop.
function fakeEtsy(shop: { userId: number; shopId: number | null; name: string }, tokenStatus = 200) {
  const sent: Sent[] = [];
  const fetch = async (url: string, init: RequestInit): Promise<Response> => {
    sent.push({ url, init });
    const { pathname } = new URL(url);
    if (pathname === '/v3/public/oauth/token') {
      if (tokenStatus !== 200) return json(tokenStatus, { error: 'invalid_grant', error_description: 'code expired' });
      return json(200, { access_token: `${shop.userId}.access`, token_type: 'Bearer', expires_in: 3600, refresh_token: `${shop.userId}.refresh` });
    }
    if (pathname === '/v3/application/users/me') return json(200, shop.shopId === null ? { user_id: shop.userId } : { user_id: shop.userId, shop_id: shop.shopId });
    if (pathname === `/v3/application/shops/${shop.shopId}`) return json(200, { shop_id: shop.shopId, user_id: shop.userId, shop_name: shop.name });
    return json(404, { error: 'not found' });
  };
  return { fetch, sent };
}

// Runs start() and returns the state Etsy would send back.
function startState(flow: OAuthFlow): string {
  const state = new URL(flow.start()).searchParams.get('state');
  assert.ok(state);
  return state;
}

describe('PKCE', () => {
  it('derives the S256 challenge from RFC 7636 appendix B', () => {
    assert.equal(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('makes a fresh 43-character verifier from the allowed alphabet each time', () => {
    const a = createPkcePair();
    const b = createPkcePair();
    assert.match(a.verifier, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(a.challenge, pkceChallenge(a.verifier));
    assert.notEqual(a.verifier, b.verifier);
  });
});

describe('buildAuthorizeUrl', () => {
  it('asks Etsy for a code with S256 PKCE, the state and the three scopes', () => {
    const url = buildAuthorizeUrl({ keystring: 'key123', redirectUri: REDIRECT_URI, state: 'st', challenge: 'ch' });
    assert.ok(url.startsWith('https://www.etsy.com/oauth/connect?'));
    assert.ok(url.includes('scope=listings_r%20listings_w%20shops_r'));
    assert.deepEqual(Object.fromEntries(new URL(url).searchParams), {
      response_type: 'code',
      client_id: 'key123',
      redirect_uri: REDIRECT_URI,
      scope: 'listings_r listings_w shops_r',
      state: 'st',
      code_challenge: 'ch',
      code_challenge_method: 'S256',
    });
  });
});

describe('createStateStore', () => {
  it('returns the verifier once, then never again', () => {
    const states = createStateStore(testClock());
    const state = states.issue('verifier-1');
    assert.equal(states.take(state), 'verifier-1');
    assert.equal(states.take(state), undefined);
  });

  it('rejects an unknown state', () => {
    const states = createStateStore(testClock());
    states.issue('verifier-1');
    assert.equal(states.take('made-up'), undefined);
  });

  it('accepts a state just inside 10 minutes and rejects one at 10 minutes', () => {
    const clock = testClock();
    const states = createStateStore(clock);
    const early = states.issue('early');
    const late = states.issue('late');
    clock.advance(STATE_TTL_MS - 1);
    assert.equal(states.take(early), 'early');
    clock.advance(1);
    assert.equal(states.take(late), undefined);
  });

  it('issues a different random state each time', () => {
    const states = createStateStore(testClock());
    const a = states.issue('v');
    const b = states.issue('v');
    assert.notEqual(a, b);
    assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  });

  it('keeps only the newest 20 pending sign-ins', () => {
    const states = createStateStore(testClock());
    const issued = Array.from({ length: 21 }, (_, i) => states.issue(`v${i}`));
    assert.equal(states.take(issued[0] ?? ''), undefined);
    assert.equal(states.take(issued[1] ?? ''), 'v1');
    assert.equal(states.take(issued[20] ?? ''), 'v20');
  });
});

describe('parseTokenResponse', () => {
  it('reads the tokens, lifetime and granted scopes', () => {
    assert.deepEqual(parseTokenResponse({ access_token: 'a', refresh_token: 'r', expires_in: 3600, scope: 'shops_r' }), {
      accessToken: 'a',
      refreshToken: 'r',
      expiresInSec: 3600,
      scope: 'shops_r',
    });
  });

  for (const [name, body] of [
    ['a non-object', 'oops'],
    ['a missing access_token', { refresh_token: 'SECRET-R', expires_in: 3600 }],
    ['a missing refresh_token', { access_token: 'SECRET-A', expires_in: 3600 }],
    ['a zero expires_in', { access_token: 'SECRET-A', refresh_token: 'SECRET-R', expires_in: 0 }],
  ] as const) {
    it(`rejects ${name} without echoing token values`, () => {
      assert.throws(() => parseTokenResponse(body), (error: unknown) => error instanceof Error && !error.message.includes('SECRET'));
    });
  }
});

describe('createOAuthFlow', () => {
  let db: DatabaseSync;
  let store: TokenStore;
  const clock = testClock();

  function flowFor(etsy: ReturnType<typeof fakeEtsy>): OAuthFlow {
    const etsyFetch = createEtsyClient({ keystring: 'key123', sharedSecret: 'secret456', db, fetch: etsy.fetch, throttle: (task) => task(), clock });
    return createOAuthFlow({ keystring: 'key123', redirectUri: REDIRECT_URI, etsyFetch, store, clock });
  }

  const callback = (state: string, extra: Record<string, string> = { code: 'the-code' }) => new URLSearchParams({ state, ...extra });

  beforeEach(() => {
    db = openDb(':memory:');
    store = createSqliteTokenStore(db);
  });

  it('exchanges the code with the verifier, resolves the shop and stores the connection', async () => {
    const etsy = fakeEtsy({ userId: 42, shopId: 777, name: 'Shirt Shop' });
    const flow = flowFor(etsy);
    const authorizeUrl = new URL(flow.start());
    const state = authorizeUrl.searchParams.get('state') ?? '';

    const connection = await flow.finish(callback(state));

    const [token, me, shop] = etsy.sent;
    assert.ok(token && me && shop);
    assert.equal(token.url, 'https://api.etsy.com/v3/public/oauth/token');
    assert.equal(token.init.method, 'POST');
    const form = new URLSearchParams(String(token.init.body));
    assert.equal(form.get('grant_type'), 'authorization_code');
    assert.equal(form.get('client_id'), 'key123');
    assert.equal(form.get('redirect_uri'), REDIRECT_URI);
    assert.equal(form.get('code'), 'the-code');
    const verifier = form.get('code_verifier') ?? '';
    assert.equal(pkceChallenge(verifier), authorizeUrl.searchParams.get('code_challenge'));
    assert.equal(new Headers(me.init.headers).get('authorization'), 'Bearer 42.access');
    assert.equal(shop.url, 'https://api.etsy.com/v3/application/shops/777');

    const expected = {
      etsyShopId: 777,
      etsyUserId: 42,
      name: 'Shirt Shop',
      accessToken: '42.access',
      refreshToken: '42.refresh',
      accessExpiresAt: clock.now() + 3600 * 1000,
      refreshExpiresAt: clock.now() + REFRESH_TOKEN_LIFETIME_MS,
      scopes: 'listings_r listings_w shops_r',
      connectedAt: clock.now(),
    };
    assert.deepEqual(connection, expected);
    assert.deepEqual(store.get(), expected);
  });

  it('never writes a token into the call log', async () => {
    const flow = flowFor(fakeEtsy({ userId: 42, shopId: 777, name: 'Shirt Shop' }));
    await flow.finish(callback(startState(flow)));
    const logged = JSON.stringify(db.prepare('SELECT * FROM etsy_calls').all());
    assert.ok(!logged.includes('42.access') && !logged.includes('42.refresh') && !logged.includes('the-code'));
  });

  it('rejects a callback whose state was not issued, without calling Etsy', async () => {
    const etsy = fakeEtsy({ userId: 42, shopId: 777, name: 'Shirt Shop' });
    const flow = flowFor(etsy);
    flow.start();
    await assert.rejects(flow.finish(callback('forged-state')), OAuthError);
    await assert.rejects(flow.finish(new URLSearchParams({ code: 'the-code' })), OAuthError);
    assert.equal(etsy.sent.length, 0);
    assert.equal(store.get(), undefined);
  });

  it('rejects a state used a second time', async () => {
    const flow = flowFor(fakeEtsy({ userId: 42, shopId: 777, name: 'Shirt Shop' }));
    const state = startState(flow);
    await flow.finish(callback(state));
    await assert.rejects(flow.finish(callback(state)), /already used/);
  });

  it('rejects a state older than 10 minutes', async () => {
    const etsy = fakeEtsy({ userId: 42, shopId: 777, name: 'Shirt Shop' });
    const flow = flowFor(etsy);
    const state = startState(flow);
    clock.advance(STATE_TTL_MS);
    await assert.rejects(flow.finish(callback(state)), OAuthError);
    assert.equal(etsy.sent.length, 0);
  });

  it('reports a denied consent and uses up the state', async () => {
    const etsy = fakeEtsy({ userId: 42, shopId: 777, name: 'Shirt Shop' });
    const flow = flowFor(etsy);
    const state = startState(flow);
    await assert.rejects(flow.finish(callback(state, { error: 'access_denied' })), /not granted/);
    await assert.rejects(flow.finish(callback(state)), /already used/);
    assert.equal(etsy.sent.length, 0);
  });

  it('refuses a callback with no code', async () => {
    const flow = flowFor(fakeEtsy({ userId: 42, shopId: 777, name: 'Shirt Shop' }));
    await assert.rejects(flow.finish(callback(startState(flow), {})), /no authorization code|did not return/);
  });

  it('passes a failed token exchange on as an EtsyError and stores nothing', async () => {
    const flow = flowFor(fakeEtsy({ userId: 42, shopId: 777, name: 'Shirt Shop' }, 400));
    await assert.rejects(flow.finish(callback(startState(flow))), EtsyError);
    assert.equal(store.get(), undefined);
  });

  it('refuses an Etsy account that has no shop', async () => {
    const flow = flowFor(fakeEtsy({ userId: 42, shopId: null, name: '' }));
    await assert.rejects(flow.finish(callback(startState(flow))), /has no shop/);
    assert.equal(store.get(), undefined);
  });

  it('refuses a different shop than the stored one and keeps the stored tokens', async () => {
    const first = flowFor(fakeEtsy({ userId: 42, shopId: 777, name: 'Shirt Shop' }));
    const stored = await first.finish(callback(startState(first)));

    const other = flowFor(fakeEtsy({ userId: 99, shopId: 888, name: 'Other Shop' }));
    await assert.rejects(other.finish(callback(startState(other))), (error: unknown) => {
      assert.ok(error instanceof OAuthError);
      assert.match(error.message, /connected to the Etsy shop "Shirt Shop"/);
      return true;
    });
    assert.deepEqual(store.get(), stored);
  });

  it('replaces the tokens when the same shop reconnects', async () => {
    const first = flowFor(fakeEtsy({ userId: 42, shopId: 777, name: 'Shirt Shop' }));
    await first.finish(callback(startState(first)));
    clock.advance(60_000);

    const again = flowFor(fakeEtsy({ userId: 42, shopId: 777, name: 'Shirt Shop Renamed' }));
    const reconnected = await again.finish(callback(startState(again)));
    assert.equal(reconnected.name, 'Shirt Shop Renamed');
    assert.equal(reconnected.connectedAt, clock.now());
    assert.deepEqual(store.get(), reconnected);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM shop').get()?.['n'], 1);
  });
});

describe('/oauth routes', () => {
  const connection = {
    etsyShopId: 777,
    etsyUserId: 42,
    name: 'Shirt Shop',
    accessToken: 'a',
    refreshToken: 'r',
    accessExpiresAt: 0,
    refreshExpiresAt: 0,
    scopes: '',
    connectedAt: 0,
  };
  const stubFlow = (finish: OAuthFlow['finish']): OAuthFlow => ({ start: () => 'https://www.etsy.com/oauth/connect?state=s', finish });

  it('redirects /oauth/start to Etsy', async () => {
    const app = createApp({ oauth: stubFlow(async () => connection) });
    const res = await app.request('http://localhost:3003/oauth/start');
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), 'https://www.etsy.com/oauth/connect?state=s');
  });

  it('answers 503 when the Etsy keys are not configured', async () => {
    const app = createApp();
    assert.equal((await app.request('http://localhost:3003/oauth/start')).status, 503);
    assert.equal((await app.request('http://localhost:3003/oauth/redirect?state=s&code=c')).status, 503);
  });

  it('passes the callback query to the flow and names the connected shop', async () => {
    let received = '';
    const app = createApp({
      oauth: stubFlow(async (query) => {
        received = query.toString();
        return connection;
      }),
    });
    const res = await app.request('http://localhost:3003/oauth/redirect?code=c&state=s');
    assert.equal(res.status, 200);
    assert.equal(received, 'code=c&state=s');
    assert.match(await res.text(), /Connected to the Etsy shop "Shirt Shop"/);
  });

  it('shows an OAuthError message with 400', async () => {
    const app = createApp({ oauth: stubFlow(async () => Promise.reject(new OAuthError('different shop'))) });
    const res = await app.request('http://localhost:3003/oauth/redirect?code=c&state=s');
    assert.equal(res.status, 400);
    assert.equal(await res.text(), 'different shop');
  });

  it('hides other errors behind a generic 502', async (t) => {
    t.mock.method(console, 'error', () => {});
    const app = createApp({ oauth: stubFlow(async () => Promise.reject(new EtsyError(400, '/v3/public/oauth/token', 'internal detail'))) });
    const res = await app.request('http://localhost:3003/oauth/redirect?code=c&state=s');
    assert.equal(res.status, 502);
    assert.doesNotMatch(await res.text(), /internal detail/);
  });

  it('refuses a callback carrying a foreign Origin', async () => {
    const app = createApp({ oauth: stubFlow(async () => connection) });
    const res = await app.request('http://localhost:3003/oauth/redirect?code=c&state=s', { headers: { origin: 'https://evil.example' } });
    assert.equal(res.status, 403);
  });
});
