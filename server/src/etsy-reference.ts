// Prints the connected shop's reference data: profiles, sections, the T-shirt taxonomy
// node and its size/color variation ids. About 7 real Etsy calls (more if the shop has
// over 100 processing profiles). Run from the repo root: npm run etsy:reference
import { openDb } from './db.ts';
import { createEtsyClient, EtsyError, withAuth } from './etsy/client.ts';
import { fetchShopReference, type VariationProperty } from './etsy/reference.ts';
import { createAccessTokens, createSqliteTokenStore, NotConnectedError } from './etsy/token-store.ts';

const MAX_VALUES_SHOWN = 40;

const keystring = process.env['ETSY_KEYSTRING']?.trim();
const sharedSecret = process.env['ETSY_SHARED_SECRET']?.trim();
if (!keystring || !sharedSecret) {
  console.error('ETSY_KEYSTRING and ETSY_SHARED_SECRET must be set. Copy .env.example to .env at the repo root and fill them in.');
  process.exit(1);
}

const db = openDb();
const store = createSqliteTokenStore(db);

function printProperty(label: string, property: VariationProperty | undefined, scaleId?: number): void {
  if (!property) {
    console.log(`${label}: not found`);
    return;
  }
  console.log(`${label}: "${property.name}" property_id=${property.propertyId}`);
  for (const scale of property.scales) {
    console.log(`  scale ${scale.scaleId} "${scale.name}"${scale.scaleId === scaleId ? '  ← chosen' : ''}`);
  }
  const values = scaleId === undefined ? property.values : property.values.filter((v) => v.scaleId === scaleId);
  const shown = values.slice(0, MAX_VALUES_SHOWN).map((v) => `${v.name}=${v.valueId}`);
  console.log(`  values (${values.length}${scaleId === undefined ? '' : ' on the chosen scale'}): ${shown.join(', ')}${values.length > shown.length ? ', …' : ''}`);
}

try {
  const shop = store.get();
  if (!shop) throw new NotConnectedError('No shop connected yet. Start the server and open http://localhost:3003/oauth/start');
  const keyed = createEtsyClient({ keystring, sharedSecret, db });
  const ref = await fetchShopReference(withAuth(keyed, createAccessTokens({ store, keystring, etsyFetch: keyed })), shop.etsyShopId);

  console.log(`Shop: ${shop.name} (shop_id ${shop.etsyShopId})\n`);
  console.log('Shipping profiles:');
  for (const p of ref.shippingProfiles) console.log(`  ${p.id}  ${p.title} (ships from ${p.originCountry ?? '?'})`);
  console.log('Return policies:');
  for (const p of ref.returnPolicies) {
    console.log(`  ${p.id}  returns=${p.acceptsReturns} exchanges=${p.acceptsExchanges} deadline=${p.returnDeadlineDays ?? '-'} days`);
  }
  console.log('Processing profiles:');
  for (const p of ref.processingProfiles) console.log(`  ${p.id}  ${p.readinessState} ${p.label}`);
  console.log('Sections:');
  for (const s of ref.sections) console.log(`  ${s.id}  ${s.title}`);

  console.log('\nT-shirt taxonomy candidates:');
  for (const c of ref.tshirtCandidates) console.log(`  ${c.id}  ${c.path.join(' > ')}${c.id === ref.tshirt?.id ? '  ← chosen' : ''}`);
  if (!ref.tshirt) console.log('  No single unisex adult T-shirt node; pick one from the list above.');

  console.log('');
  printProperty('Size', ref.size, ref.sizeScaleId);
  printProperty('Color', ref.color);
  const others = ref.variationProperties.filter((p) => p !== ref.size && p !== ref.color);
  if (others.length > 0) console.log(`Other variation properties: ${others.map((p) => `${p.name}=${p.propertyId}`).join(', ')}`);
} catch (error) {
  if (error instanceof EtsyError || error instanceof NotConnectedError) {
    console.error(error.message);
  } else {
    console.error('Reading reference data failed:', error);
  }
  process.exitCode = 1;
} finally {
  db.close();
}
