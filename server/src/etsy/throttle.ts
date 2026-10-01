// Keeps Etsy calls under the per-second limit and computes 429 backoff delays.
// Etsy allows 5 requests per second per API key; we stay one below it.

export const MAX_PER_SECOND = 4;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60_000;

export type Clock = { now: () => number; sleep: (ms: number) => Promise<void> };

export const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export type Throttle = <T>(task: () => Promise<T>) => Promise<T>;

// Starts each task at least 1000 / maxPerSecond ms after the previous one.
// Slots are reserved synchronously, so concurrent callers queue up in call order.
export function createThrottle(maxPerSecond: number = MAX_PER_SECOND, clock: Clock = realClock): Throttle {
  const interval = 1000 / maxPerSecond;
  let nextSlot = Number.NEGATIVE_INFINITY;
  return async <T>(task: () => Promise<T>): Promise<T> => {
    const now = clock.now();
    const slot = Math.max(now, nextSlot);
    nextSlot = slot + interval;
    if (slot > now) await clock.sleep(slot - now);
    return task();
  };
}

// Delay before retry number `attempt` (0-based) after a 429: exponential, but never
// shorter than Etsy's retry-after estimate (in seconds), and capped.
export function backoffMs(attempt: number, retryAfter: string | null): number {
  const exponential = BASE_BACKOFF_MS * 2 ** attempt;
  const seconds = Number(retryAfter);
  const hinted = retryAfter !== null && Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
  return Math.min(MAX_BACKOFF_MS, Math.max(exponential, hinted));
}
