// Calls to the server's /api routes. Responses are checked at runtime: TypeScript can't
// see across the network, and fetch's json() is untyped.

export const ETSY_DAILY_LIMIT = 5000; // calls per rolling 24 h for the app's API key (SPEC.md → Rate limits)

export type ShopStatus =
  | { connected: false; callsLast24h: number }
  | {
      connected: true;
      name: string;
      accessExpiresAt: number; // epoch ms
      refreshExpiresAt: number; // epoch ms; reconnecting is needed after this
      reconnectSoon: boolean; // the refresh token expires within 14 days
      callsLast24h: number;
    };

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(path, { headers: { accept: 'application/json' } });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = isRecord(body) && typeof body['error'] === 'string' ? body['error'] : `HTTP ${res.status}`;
    throw new ApiError(res.status, error);
  }
  return body;
}

function unexpected(path: string): ApiError {
  return new ApiError(0, `Unexpected response from ${path}`);
}

export async function getShop(): Promise<ShopStatus> {
  const body = await getJson('/api/shop');
  if (!isRecord(body)) throw unexpected('/api/shop');
  const { connected, callsLast24h, name, accessExpiresAt, refreshExpiresAt, reconnectSoon } = body;
  if (typeof callsLast24h !== 'number') throw unexpected('/api/shop');
  if (connected === false) return { connected, callsLast24h };
  if (
    connected !== true ||
    typeof name !== 'string' ||
    typeof accessExpiresAt !== 'number' ||
    typeof refreshExpiresAt !== 'number' ||
    typeof reconnectSoon !== 'boolean'
  ) {
    throw unexpected('/api/shop');
  }
  return { connected, name, accessExpiresAt, refreshExpiresAt, reconnectSoon, callsLast24h };
}
