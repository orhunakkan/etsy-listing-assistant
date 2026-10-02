// Starts the server on 127.0.0.1 only, so nothing else on the network can reach it.
import { createApp, HOSTNAME, PORT } from './app.ts';
import { openDb } from './db.ts';
import { createEtsyClient, withAuth } from './etsy/client.ts';
import { createOAuthFlow, type OAuthFlow } from './etsy/oauth.ts';
import { fetchShopReference } from './etsy/reference.ts';
import { countCallsLast24h, createAccessTokens, createSqliteTokenStore, NotConnectedError, shopStatus } from './etsy/token-store.ts';
import { serve } from './http/serve.ts';
import { createReferenceCache, type ReferenceSource } from './settings/routes.ts';

const keystring = process.env['ETSY_KEYSTRING']?.trim();
const sharedSecret = process.env['ETSY_SHARED_SECRET']?.trim();
// Must match a callback URL registered on the Etsy app, character for character.
const redirectUri = process.env['ETSY_REDIRECT_URI']?.trim() || `http://localhost:${PORT}/oauth/redirect`;

const db = openDb();
const store = createSqliteTokenStore(db);
let oauth: OAuthFlow | undefined;
let reference: ReferenceSource | undefined;
if (keystring && sharedSecret) {
  const etsyFetch = createEtsyClient({ keystring, sharedSecret, db });
  oauth = createOAuthFlow({ keystring, redirectUri, etsyFetch, store });
  // One AccessTokens per process, so token refreshes stay single-flight across all callers.
  const shopFetch = withAuth(etsyFetch, createAccessTokens({ store, keystring, etsyFetch }));
  reference = createReferenceCache(async () => {
    const shop = store.get();
    if (!shop) throw new NotConnectedError('No shop connected yet');
    return fetchShopReference(shopFetch, shop.etsyShopId);
  });
} else {
  console.warn('ETSY_KEYSTRING and ETSY_SHARED_SECRET are not set, so connecting to Etsy is disabled.');
}

const app = createApp({
  oauth,
  db,
  reference,
  shopStatus: () => {
    const now = Date.now();
    return shopStatus(store.get(), countCallsLast24h(db, now), now);
  },
});

const server = serve(app.fetch, HOSTNAME, PORT, (port) => {
  console.log(`Listening on http://localhost:${port}`);
  if (oauth) console.log(`Connect your Etsy shop: http://localhost:${port}/oauth/start`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
