// Makes one real Etsy call (the ping endpoint) to confirm the API key and shared secret work.
// If a shop is connected, makes one more (getMe) with its token, refreshing it if needed,
// and shows the shop and token expiry. Run from the repo root: npm run etsy:check
import { openDb } from './db.ts';
import { createEtsyClient, EtsyError, withAuth } from './etsy/client.ts';
import { countCallsLast24h, createAccessTokens, createSqliteTokenStore, NotConnectedError, shopStatus } from './etsy/token-store.ts';

const keystring = process.env['ETSY_KEYSTRING']?.trim();
const sharedSecret = process.env['ETSY_SHARED_SECRET']?.trim();
if (!keystring || !sharedSecret) {
  console.error('ETSY_KEYSTRING and ETSY_SHARED_SECRET must be set. Copy .env.example to .env at the repo root and fill them in.');
  process.exit(1);
}

const db = openDb();
const etsyFetch = createEtsyClient({ keystring, sharedSecret, db });
const store = createSqliteTokenStore(db);
const formatTime = (ms: number): string => new Date(ms).toLocaleString();

try {
  const res = await etsyFetch('/v3/application/openapi-ping');
  const body: unknown = await res.json();
  const applicationId = typeof body === 'object' && body !== null && 'application_id' in body ? body.application_id : '?';
  console.log(`Etsy responded HTTP ${res.status} (application id: ${String(applicationId)})`);
  console.log(`  requests left today: ${res.headers.get('x-remaining-today') ?? 'not reported'}`);

  if (store.get() === undefined) {
    console.log('No shop connected yet. Start the server and open http://localhost:3003/oauth/start');
  } else {
    const authed = withAuth(etsyFetch, createAccessTokens({ store, keystring, etsyFetch }));
    const me = await authed('/v3/application/users/me');
    await me.body?.cancel();
    const status = shopStatus(store.get(), countCallsLast24h(db, Date.now()), Date.now());
    if (status.connected) {
      console.log(`Connected shop: ${status.name} (token accepted, HTTP ${me.status})`);
      console.log(`  access token expires:  ${formatTime(status.accessExpiresAt)}`);
      console.log(`  reconnect needed by:   ${formatTime(status.refreshExpiresAt)}${status.reconnectSoon ? '  ← within 14 days' : ''}`);
      console.log(`  Etsy calls in the last 24 h: ${status.callsLast24h}`);
    }
  }
} catch (error) {
  if (error instanceof EtsyError || error instanceof NotConnectedError) {
    console.error(`Etsy request failed: ${error.message}`);
  } else {
    console.error('Etsy request failed:', error);
  }
  process.exitCode = 1;
} finally {
  db.close();
}
