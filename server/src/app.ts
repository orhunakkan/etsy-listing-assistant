// Builds the Hono app. Kept apart from index.ts so tests can call app.request()
// without starting a server.
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { OAuthError, type OAuthFlow } from './etsy/oauth.ts';
import type { ShopStatus } from './etsy/token-store.ts';
import { localOnly } from './http/local-only.ts';

export const HOSTNAME = '127.0.0.1';
export const PORT = 3003; // must match the Etsy callback URL in ETSY_REDIRECT_URI
const VITE_DEV_PORT = 5173; // in dev the Vite server proxies /api to this one, so its origin is the app's own

export type AppDeps = {
  oauth?: OAuthFlow | undefined; // undefined when the Etsy keys aren't configured
  shopStatus?: (() => ShopStatus) | undefined;
};

export function createApp(deps: AppDeps = {}): Hono {
  const app = new Hono();

  app.use(
    localOnly({
      hosts: [`localhost:${PORT}`, `127.0.0.1:${PORT}`],
      origins: [PORT, VITE_DEV_PORT].flatMap((port) => [`http://localhost:${port}`, `http://127.0.0.1:${port}`]),
    }),
  );
  app.use(
    secureHeaders({
      contentSecurityPolicy: { defaultSrc: ["'self'"], imgSrc: ["'self'", 'blob:', 'data:'] },
      xFrameOptions: 'DENY',
      strictTransportSecurity: false, // plain-HTTP localhost; turn on when hosted over HTTPS
    }),
  );

  app.get('/api/health', (c) => c.json({ ok: true }));

  app.get('/api/shop', (c) => (deps.shopStatus ? c.json(deps.shopStatus()) : c.json({ error: 'not configured' }, 503)));

  // Plain-text pages for now; the Connect page (T13) replaces them.
  const notConfigured = 'Etsy is not configured: set ETSY_KEYSTRING and ETSY_SHARED_SECRET in .env, then restart the server.';

  app.get('/oauth/start', (c) => (deps.oauth ? c.redirect(deps.oauth.start(), 302) : c.text(notConfigured, 503)));

  app.get('/oauth/redirect', async (c) => {
    if (!deps.oauth) return c.text(notConfigured, 503);
    try {
      const shop = await deps.oauth.finish(new URL(c.req.url).searchParams);
      return c.text(`Connected to the Etsy shop "${shop.name}". You can close this tab.`);
    } catch (error) {
      if (error instanceof OAuthError) return c.text(error.message, 400);
      console.error('Etsy connection failed:', error); // EtsyError and parse errors never carry tokens
      return c.text('Connecting to Etsy failed. See the server log for details, then start again.', 502);
    }
  });

  return app;
}
