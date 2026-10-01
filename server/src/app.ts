// Builds the Hono app. Kept apart from index.ts so tests can call app.request()
// without starting a server.
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { localOnly } from './http/local-only.ts';

export const HOSTNAME = '127.0.0.1';
export const PORT = 3003; // must match the Etsy callback URL in ETSY_REDIRECT_URI
const VITE_DEV_PORT = 5173; // in dev the Vite server proxies /api to this one, so its origin is the app's own

export function createApp(): Hono {
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

  return app;
}
