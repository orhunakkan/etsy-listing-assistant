// Stores the connected shop and its OAuth tokens, and hands out a valid access token,
// refreshing it when needed. The TokenStore interface keeps the rest of the code off
// the shop table, so hosted storage (encrypted, or a KMS) can replace it later
// (SPEC.md → Future expansion). Tokens are never logged.
import type { DatabaseSync } from 'node:sqlite';
import type { BearerTokens, EtsyFetch } from './client.ts';
import { parseTokenResponse, REFRESH_TOKEN_LIFETIME_MS, TOKEN_PATH } from './oauth.ts';
import { type Clock, realClock } from './throttle.ts';

export const REFRESH_EARLY_MS = 60_000; // refresh this long before the access token expires
export const REFRESH_WARNING_MS = 14 * 24 * 60 * 60 * 1000; // warn when reconnecting is this close
const DAY_MS = 24 * 60 * 60 * 1000;

// No shop is connected, or its refresh token has expired: the seller must connect again.
export class NotConnectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotConnectedError';
  }
}

export type ShopConnection = {
  etsyShopId: number;
  etsyUserId: number;
  name: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number; // epoch ms
  refreshExpiresAt: number; // epoch ms
  scopes: string; // space-separated, as Etsy grants them
  connectedAt: number; // epoch ms
};

export interface TokenStore {
  get(): ShopConnection | undefined;
  // Inserts the one shop row, or replaces it. Callers check the shop id first (see oauth.ts).
  save(connection: ShopConnection): void;
}

export function createSqliteTokenStore(db: DatabaseSync): TokenStore {
  const select = db.prepare(
    `SELECT etsy_shop_id, etsy_user_id, name, access_token, refresh_token,
            access_expires_at, refresh_expires_at, scopes, connected_at
     FROM shop WHERE id = 1`,
  );
  const upsert = db.prepare(
    `INSERT INTO shop (id, etsy_shop_id, etsy_user_id, name, access_token, refresh_token,
                       access_expires_at, refresh_expires_at, scopes, connected_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       etsy_shop_id = excluded.etsy_shop_id, etsy_user_id = excluded.etsy_user_id, name = excluded.name,
       access_token = excluded.access_token, refresh_token = excluded.refresh_token,
       access_expires_at = excluded.access_expires_at, refresh_expires_at = excluded.refresh_expires_at,
       scopes = excluded.scopes, connected_at = excluded.connected_at`,
  );

  return {
    get() {
      const row = select.get();
      if (row === undefined) return undefined;
      return {
        etsyShopId: Number(row['etsy_shop_id']),
        etsyUserId: Number(row['etsy_user_id']),
        name: String(row['name']),
        accessToken: String(row['access_token']),
        refreshToken: String(row['refresh_token']),
        accessExpiresAt: Number(row['access_expires_at']),
        refreshExpiresAt: Number(row['refresh_expires_at']),
        scopes: String(row['scopes']),
        connectedAt: Number(row['connected_at']),
      };
    },
    save(c) {
      upsert.run(
        c.etsyShopId,
        c.etsyUserId,
        c.name,
        c.accessToken,
        c.refreshToken,
        c.accessExpiresAt,
        c.refreshExpiresAt,
        c.scopes,
        c.connectedAt,
      );
    },
  };
}

// get() returns a valid access token, refreshing first when it has expired or is about to.
// refreshAfter(rejected) runs after a 401, and refreshes unless another caller already has.
// `etsyFetch` is the keyed client without a bearer token. At most one refresh runs at a
// time, and the new tokens are saved before any caller gets the new access token.
export function createAccessTokens(options: {
  store: TokenStore;
  keystring: string;
  etsyFetch: EtsyFetch;
  clock?: Clock;
}): BearerTokens {
  const { store, keystring, etsyFetch, clock = realClock } = options;
  let inFlight: Promise<string> | undefined;

  function connection(): ShopConnection {
    const current = store.get();
    if (current === undefined) throw new NotConnectedError('No Etsy shop is connected yet.');
    return current;
  }

  async function runRefresh(): Promise<string> {
    const current = connection();
    const requestedAt = clock.now(); // expiries count from before the request, to err early
    if (current.refreshExpiresAt <= requestedAt) {
      throw new NotConnectedError(`The Etsy connection for "${current.name}" has expired. Connect the shop again.`);
    }
    const res = await etsyFetch(TOKEN_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: keystring, refresh_token: current.refreshToken }),
    });
    const tokens = parseTokenResponse(await res.json());
    store.save({
      ...current,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessExpiresAt: requestedAt + tokens.expiresInSec * 1000,
      refreshExpiresAt: requestedAt + REFRESH_TOKEN_LIFETIME_MS,
      scopes: tokens.scope ?? current.scopes,
    });
    return tokens.accessToken;
  }

  function refresh(): Promise<string> {
    inFlight ??= runRefresh().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  }

  return {
    async get() {
      if (inFlight) return inFlight;
      const current = connection();
      return current.accessExpiresAt - REFRESH_EARLY_MS > clock.now() ? current.accessToken : refresh();
    },
    async refreshAfter(rejected) {
      if (inFlight) return inFlight;
      const current = connection();
      return current.accessToken === rejected ? refresh() : current.accessToken;
    },
  };
}

export type ShopStatus =
  | { connected: false; callsLast24h: number }
  | {
      connected: true;
      name: string;
      accessExpiresAt: number;
      refreshExpiresAt: number;
      reconnectSoon: boolean; // the refresh token expires within 14 days
      callsLast24h: number;
    };

// What /api/shop shows. Never includes a token.
export function shopStatus(connection: ShopConnection | undefined, callsLast24h: number, now: number): ShopStatus {
  if (connection === undefined) return { connected: false, callsLast24h };
  return {
    connected: true,
    name: connection.name,
    accessExpiresAt: connection.accessExpiresAt,
    refreshExpiresAt: connection.refreshExpiresAt,
    reconnectSoon: connection.refreshExpiresAt - now <= REFRESH_WARNING_MS,
    callsLast24h,
  };
}

// Etsy calls in the rolling 24 hours before `now`, read from the etsy_calls log.
export function countCallsLast24h(db: DatabaseSync, now: number): number {
  return Number(db.prepare('SELECT COUNT(*) AS n FROM etsy_calls WHERE ts > ?').get(now - DAY_MS)?.['n'] ?? 0);
}
