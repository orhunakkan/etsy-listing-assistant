// The Etsy HTTP client. Every request goes through one throttle, carries the API key,
// retries 429s with backoff and is logged to etsy_calls (never with tokens).
import type { DatabaseSync } from 'node:sqlite';
import { backoffMs, type Clock, createThrottle, realClock, type Throttle } from './throttle.ts';

export const ETSY_API_BASE = 'https://api.etsy.com';
export const MAX_RETRIES = 4; // retries after the first 429
const LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ERROR_DETAIL = 300; // characters of Etsy's error text kept in EtsyError

export class EtsyError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(status: number, path: string, detail: string) {
    super(`Etsy ${path} returned HTTP ${status}${detail ? `: ${detail}` : ''}`);
    this.name = 'EtsyError';
    this.status = status;
    this.path = path;
  }
}

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;
export type EtsyFetch = (path: string, init?: RequestInit) => Promise<Response>;

export type EtsyClientOptions = {
  keystring: string;
  sharedSecret: string;
  db: DatabaseSync;
  fetch?: Fetch;
  throttle?: Throttle;
  clock?: Clock;
};

// Returns etsyFetch(path, init): resolves with the response when it is 2xx and
// throws EtsyError otherwise. `path` is relative to the API base, e.g. '/v3/application/openapi-ping'.
export function createEtsyClient(options: EtsyClientOptions): EtsyFetch {
  const { keystring, sharedSecret, db, fetch: send = fetch, clock = realClock } = options;
  const throttle = options.throttle ?? createThrottle(undefined, clock);
  const insertCall = db.prepare(
    'INSERT INTO etsy_calls (ts, method, path, status, ms, remaining_today) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const pruneCalls = db.prepare('DELETE FROM etsy_calls WHERE ts < ?');

  async function attempt(url: URL, init: RequestInit & { method: string }): Promise<Response> {
    const started = clock.now();
    const log = (status: number | null, remainingToday: number | null): void => {
      insertCall.run(started, init.method, url.pathname, status, clock.now() - started, remainingToday);
      pruneCalls.run(started - LOG_RETENTION_MS);
    };
    try {
      const res = await send(url.href, init);
      log(res.status, toInteger(res.headers.get('x-remaining-today')));
      return res;
    } catch (error) {
      log(null, null);
      throw error;
    }
  }

  return async (path, init = {}) => {
    const url = new URL(path, ETSY_API_BASE);
    if (url.origin !== ETSY_API_BASE) throw new Error(`Refusing to send the Etsy API key: ${path} is not an Etsy API path`);
    const headers = new Headers(init.headers);
    headers.set('x-api-key', `${keystring}:${sharedSecret}`);
    const request = { ...init, method: (init.method ?? 'GET').toUpperCase(), headers };

    for (let retry = 0; ; retry++) {
      const res = await throttle(() => attempt(url, request));
      if (res.ok) return res;
      if (res.status === 429 && retry < MAX_RETRIES) {
        await res.body?.cancel();
        await clock.sleep(backoffMs(retry, res.headers.get('retry-after')));
        continue;
      }
      throw new EtsyError(res.status, url.pathname, await errorDetail(res));
    }
  };
}

function toInteger(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

// Etsy errors look like { "error": "..." }; fall back to the raw text, shortened.
async function errorDetail(res: Response): Promise<string> {
  const text = await res.text();
  let detail = text;
  try {
    const body: unknown = JSON.parse(text);
    if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
      detail = body.error;
    }
  } catch {
    // not JSON; keep the raw text
  }
  detail = detail.trim();
  return detail.length > MAX_ERROR_DETAIL ? `${detail.slice(0, MAX_ERROR_DETAIL)}…` : detail;
}
