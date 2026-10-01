// Makes one real Etsy call (the ping endpoint) to confirm the API key and shared secret work.
// Run from the repo root: npm run etsy:check
import { openDb } from './db.ts';
import { createEtsyClient, EtsyError } from './etsy/client.ts';

const keystring = process.env['ETSY_KEYSTRING']?.trim();
const sharedSecret = process.env['ETSY_SHARED_SECRET']?.trim();
if (!keystring || !sharedSecret) {
  console.error('ETSY_KEYSTRING and ETSY_SHARED_SECRET must be set. Copy .env.example to .env at the repo root and fill them in.');
  process.exit(1);
}

const db = openDb();
const etsyFetch = createEtsyClient({ keystring, sharedSecret, db });

try {
  const res = await etsyFetch('/v3/application/openapi-ping');
  const body: unknown = await res.json();
  const applicationId = typeof body === 'object' && body !== null && 'application_id' in body ? body.application_id : '?';
  console.log(`Etsy responded HTTP ${res.status} (application id: ${String(applicationId)})`);
  console.log(`  requests left today: ${res.headers.get('x-remaining-today') ?? 'not reported'}`);
} catch (error) {
  if (error instanceof EtsyError) {
    console.error(`Etsy request failed: ${error.message}`);
  } else {
    console.error('Etsy request failed:', error);
  }
  process.exitCode = 1;
} finally {
  db.close();
}
