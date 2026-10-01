// Connects the one Etsy shop with OAuth 2.0 authorization code + PKCE (S256).
// https://developers.etsy.com/documentation/essentials/authentication
// The state and PKCE verifier stay in memory: single use, 10-minute expiry, so a
// server restart only cancels a sign-in that is in progress (tasks/plan.md → Phase 1).
import { createHash, randomBytes } from 'node:crypto';
import type { EtsyFetch } from './client.ts';
import { type Clock, realClock } from './throttle.ts';
import type { ShopConnection, TokenStore } from './token-store.ts';

export const AUTHORIZE_URL = 'https://www.etsy.com/oauth/connect';
export const TOKEN_PATH = '/v3/public/oauth/token';
export const SCOPES = ['listings_r', 'listings_w', 'shops_r'] as const;
export const STATE_TTL_MS = 10 * 60 * 1000;
export const REFRESH_TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000; // Etsy doesn't return it; documented as 90 days
const MAX_PENDING_STATES = 20; // caps memory if /oauth/start is hit repeatedly
const RANDOM_BYTES = 32; // base64url → 43 characters, the minimum PKCE verifier length

// A failure whose message is safe and useful to show the seller.
export class OAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthError';
  }
}

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(RANDOM_BYTES).toString('base64url');
  return { verifier, challenge: pkceChallenge(verifier) };
}

export type PendingStates = {
  issue: (verifier: string) => string; // returns a new random state bound to the verifier
  take: (state: string) => string | undefined; // the verifier, once; undefined if unknown, used or expired
};

export function createStateStore(clock: Clock = realClock): PendingStates {
  const pending = new Map<string, { verifier: string; expiresAt: number }>();
  return {
    issue(verifier) {
      const now = clock.now();
      for (const [key, entry] of pending) if (entry.expiresAt <= now) pending.delete(key);
      for (const oldest of pending.keys()) {
        if (pending.size < MAX_PENDING_STATES) break;
        pending.delete(oldest);
      }
      const state = randomBytes(RANDOM_BYTES).toString('base64url');
      pending.set(state, { verifier, expiresAt: now + STATE_TTL_MS });
      return state;
    },
    take(state) {
      const entry = pending.get(state);
      pending.delete(state);
      return entry !== undefined && entry.expiresAt > clock.now() ? entry.verifier : undefined;
    },
  };
}

export function buildAuthorizeUrl(params: { keystring: string; redirectUri: string; state: string; challenge: string }): string {
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: params.keystring,
    redirect_uri: params.redirectUri,
    scope: SCOPES.join(' '),
    state: params.state,
    code_challenge: params.challenge,
    code_challenge_method: 'S256',
  });
  // URLSearchParams writes spaces as '+'; Etsy's docs use %20 between scopes. A literal '+' is already %2B.
  return `${AUTHORIZE_URL}?${query.toString().replaceAll('+', '%20')}`;
}

export type TokenResponse = { accessToken: string; refreshToken: string; expiresInSec: number; scope: string | undefined };

// Checks the shape of Etsy's token response. Error messages never include token values.
export function parseTokenResponse(body: unknown): TokenResponse {
  const accessToken = prop(body, 'access_token');
  const refreshToken = prop(body, 'refresh_token');
  const expiresIn = prop(body, 'expires_in');
  const scope = prop(body, 'scope');
  if (typeof accessToken !== 'string' || accessToken === '') throw new Error('Etsy token response has no access_token');
  if (typeof refreshToken !== 'string' || refreshToken === '') throw new Error('Etsy token response has no refresh_token');
  if (typeof expiresIn !== 'number' || !(expiresIn > 0)) throw new Error('Etsy token response has no valid expires_in');
  return { accessToken, refreshToken, expiresInSec: expiresIn, scope: typeof scope === 'string' ? scope : undefined };
}

export async function exchangeCode(
  etsyFetch: EtsyFetch,
  params: { keystring: string; redirectUri: string; code: string; verifier: string },
): Promise<TokenResponse> {
  const res = await etsyFetch(TOKEN_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: params.keystring,
      redirect_uri: params.redirectUri,
      code: params.code,
      code_verifier: params.verifier,
    }),
  });
  return parseTokenResponse(await res.json());
}

export type ShopIdentity = { etsyUserId: number; etsyShopId: number; name: string };

// The signed-in user (getMe) → their shop id → the shop's name (getShop).
export async function resolveShop(etsyFetch: EtsyFetch, accessToken: string): Promise<ShopIdentity> {
  const me: unknown = await (await etsyFetch('/v3/application/users/me', { headers: { authorization: `Bearer ${accessToken}` } })).json();
  const userId = positiveInteger(me, 'user_id');
  const shopId = positiveInteger(me, 'shop_id');
  if (userId === undefined) throw new Error('Etsy getMe response has no user_id');
  if (shopId === undefined) throw new OAuthError('The Etsy account you signed in with has no shop.');

  const shop: unknown = await (await etsyFetch(`/v3/application/shops/${shopId}`)).json();
  const name = prop(shop, 'shop_name');
  if (typeof name !== 'string' || name === '') throw new Error('Etsy getShop response has no shop_name');
  return { etsyUserId: userId, etsyShopId: shopId, name };
}

function prop(body: unknown, name: string): unknown {
  return typeof body === 'object' && body !== null ? Reflect.get(body, name) : undefined;
}

function positiveInteger(body: unknown, name: string): number | undefined {
  const value = prop(body, name);
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

// One shop only (SPEC D1): reconnecting must return the shop already stored.
export function assertSameShop(existing: ShopConnection | undefined, incomingShopId: number): void {
  if (existing !== undefined && existing.etsyShopId !== incomingShopId) {
    throw new OAuthError(
      `This app is connected to the Etsy shop "${existing.name}", but you signed in to a different shop. ` +
        'Nothing was changed. Sign in to Etsy as the owner of that shop and connect again.',
    );
  }
}

export type OAuthFlow = {
  start: () => string; // the Etsy consent URL to redirect the browser to
  finish: (callback: URLSearchParams) => Promise<ShopConnection>; // handles /oauth/redirect's query
};

export type OAuthConfig = {
  keystring: string;
  redirectUri: string;
  etsyFetch: EtsyFetch;
  store: TokenStore;
  clock?: Clock;
  states?: PendingStates;
};

export function createOAuthFlow(config: OAuthConfig): OAuthFlow {
  const { keystring, redirectUri, etsyFetch, store, clock = realClock } = config;
  const states = config.states ?? createStateStore(clock);

  return {
    start() {
      const { verifier, challenge } = createPkcePair();
      return buildAuthorizeUrl({ keystring, redirectUri, state: states.issue(verifier), challenge });
    },

    async finish(callback) {
      const state = callback.get('state');
      const verifier = state === null ? undefined : states.take(state);
      if (verifier === undefined) {
        throw new OAuthError('This sign-in is unknown, already used or older than 10 minutes. Start the connection again.');
      }
      const error = callback.get('error');
      if (error !== null) {
        throw new OAuthError(
          error === 'access_denied' ? 'Access was not granted on Etsy, so the shop was not connected.' : 'Etsy refused the sign-in, so the shop was not connected.',
        );
      }
      const code = callback.get('code');
      if (code === null || code === '') throw new OAuthError('Etsy did not return an authorization code.');

      const requestedAt = clock.now(); // expiries count from before the request, to err early
      const tokens = await exchangeCode(etsyFetch, { keystring, redirectUri, code, verifier });
      const shop = await resolveShop(etsyFetch, tokens.accessToken);
      assertSameShop(store.get(), shop.etsyShopId);

      const connection: ShopConnection = {
        ...shop,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessExpiresAt: requestedAt + tokens.expiresInSec * 1000,
        refreshExpiresAt: requestedAt + REFRESH_TOKEN_LIFETIME_MS,
        scopes: tokens.scope ?? SCOPES.join(' '),
        connectedAt: clock.now(),
      };
      store.save(connection);
      return connection;
    },
  };
}
