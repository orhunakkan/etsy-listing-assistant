// /api/settings (read and replace the shop's defaults) and /api/reference (the shop's
// Etsy reference data, which fills the Settings form's dropdowns).
import type { DatabaseSync } from 'node:sqlite';
import { type Context, Hono } from 'hono';
import type { ShopReference } from '../etsy/reference.ts';
import { NotConnectedError } from '../etsy/token-store.ts';
import { loadSettings, saveSettings, validateSettings } from './settings.ts';

export type ReferenceSource = { get: () => Promise<ShopReference>; refresh: () => Promise<ShopReference> };

// Fetches reference data (about 7 Etsy calls) once per server run, and again on refresh.
// Concurrent requests share one fetch. A failed fetch is not cached, so the next request
// tries again.
export function createReferenceCache(load: () => Promise<ShopReference>): ReferenceSource {
  let cached: Promise<ShopReference> | undefined;
  let pending: Promise<ShopReference> | undefined;
  const fetchNow = (): Promise<ShopReference> => {
    pending ??= load().then(
      (reference) => {
        pending = undefined;
        return reference;
      },
      (error: unknown) => {
        pending = undefined;
        cached = undefined;
        throw error;
      },
    );
    cached = pending;
    return pending;
  };
  return { get: () => cached ?? fetchNow(), refresh: fetchNow };
}

export type SettingsDeps = {
  db: DatabaseSync;
  reference?: ReferenceSource | undefined; // undefined when the Etsy keys aren't configured
  now?: () => number;
};

export function settingsRoutes(deps: SettingsDeps): Hono {
  const app = new Hono();
  const now = deps.now ?? Date.now;

  app.get('/settings', (c) => {
    const stored = loadSettings(deps.db);
    return c.json({ settings: stored?.settings ?? null, updatedAt: stored?.updatedAt ?? null });
  });

  app.put('/settings', async (c) => {
    // JSON only: a cross-site HTML form can't send it (SPEC.md → Security).
    if (!c.req.header('content-type')?.toLowerCase().startsWith('application/json')) {
      return c.json({ error: 'expected an application/json body' }, 415);
    }
    let body: unknown;
    try {
      body = JSON.parse(await c.req.text());
    } catch {
      return c.json({ errors: [{ field: '', reason: 'is not valid JSON' }] }, 400);
    }
    const result = validateSettings(body);
    if (!result.ok) return c.json({ errors: result.errors }, 400);
    return c.json(saveSettings(deps.db, result.settings, now()));
  });

  const reference = async (c: Context, load: (source: ReferenceSource) => Promise<ShopReference>) => {
    if (!deps.reference) return c.json({ error: 'Etsy is not configured' }, 503);
    try {
      return c.json(await load(deps.reference));
    } catch (error) {
      if (error instanceof NotConnectedError) return c.json({ error: 'No Etsy shop is connected' }, 409);
      console.error('Reading the shop reference data failed:', error); // EtsyError and parse errors never carry tokens
      return c.json({ error: 'Reading the shop data from Etsy failed. See the server log.' }, 502);
    }
  };

  app.get('/reference', (c) => reference(c, (source) => source.get()));
  // POST because it spends Etsy calls (SPEC.md → Security: state-changing routes).
  app.post('/reference/refresh', (c) => reference(c, (source) => source.refresh()));

  return app;
}
