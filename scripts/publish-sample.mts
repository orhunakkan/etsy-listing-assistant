// Creates ONE Etsy draft with fixed, harmless content, then reads it back and prints it
// (T9 / Checkpoint C). This is the only push that skips the guard; it never makes an
// active listing. Sizes S/M × colors Black/White at placeholder prices, 2 generated
// sample images, and the shop's first processing, shipping and return profiles.
//
// Rerun-safe: the sample item is kept in data/app.db, and a rerun resumes or re-reads
// that same draft instead of making another. About 7 reference calls + 1 create + 2
// image uploads + 1 inventory + 2 reads.
// Run from the repo root: node --env-file-if-exists=.env scripts/publish-sample.mts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { z } from 'zod';
import { DB_PATH, openDb } from '../server/src/db.ts';
import { createEtsyClient, EtsyError, type EtsyFetch, withAuth } from '../server/src/etsy/client.ts';
import type { DraftListing, ItemSize } from '../server/src/etsy/listings.ts';
import { fetchShopReference, type VariationProperty } from '../server/src/etsy/reference.ts';
import { createAccessTokens, createSqliteTokenStore, NotConnectedError } from '../server/src/etsy/token-store.ts';
import { buildInventory, type ColorOption, type SizeOption } from '../server/src/publisher/inventory.ts';
import { createPublisher, PublishError } from '../server/src/publisher/publish.ts';

const SAMPLE_BATCH = 'T9 sample draft';
const SIZES = [
  { name: 'S', price: 20 },
  { name: 'M', price: 22 },
] as const;
const COLORS = ['Black', 'White'] as const;
const QUANTITY = 1;
const SKU_PATTERN = 'SAMPLE-{size}-{color}';
// Placeholder packed size: the shop's calculated shipping profile requires one.
const ITEM_SIZE: ItemSize = { weight: 6, weightUnit: 'oz', length: 10, width: 8, height: 1, dimensionsUnit: 'in' };
const IMAGE_SIDE = 1200; // px; generated solid-color PNGs
const IMAGE_SHADES = [64, 192] as const; // dark grey, light grey

const UPLOADS = join(dirname(DB_PATH), 'uploads');

const keystring = process.env['ETSY_KEYSTRING']?.trim();
const sharedSecret = process.env['ETSY_SHARED_SECRET']?.trim();
if (!keystring || !sharedSecret) {
  console.error('ETSY_KEYSTRING and ETSY_SHARED_SECRET must be set. Copy .env.example to .env at the repo root and fill them in.');
  process.exit(1);
}

// A valid solid grey PNG (8-bit RGB), so the sample needs no image files in the repo.
function solidPng(side: number, shade: number): Uint8Array {
  const chunk = (type: string, data: Uint8Array): Buffer => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(side, 0);
  header.writeUInt32BE(side, 4);
  header.set([8, 2, 0, 0, 0], 8); // bit depth 8, colour type RGB, default compression/filter/interlace
  const row = Buffer.alloc(1 + side * 3, shade);
  row[0] = 0; // filter: none
  const pixels = deflateSync(Buffer.concat(Array.from({ length: side }, () => row)));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', pixels),
    chunk('IEND', new Uint8Array()),
  ]);
}

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`${what} not found in the shop's reference data; run npm run etsy:reference`);
  return value;
}

function findValue(property: VariationProperty, name: string, scaleId?: number) {
  return property.values.find((v) => v.name.trim().toLowerCase() === name.toLowerCase() && (scaleId === undefined || v.scaleId === scaleId));
}

// The sample item: found by its batch name, created (with its images) on the first run.
function sampleItem(db: ReturnType<typeof openDb>): number {
  const existing = db
    .prepare('SELECT items.id FROM items JOIN batches ON batches.id = items.batch_id WHERE batches.name = ?')
    .get(SAMPLE_BATCH)?.['id'];
  if (typeof existing === 'number') return existing;

  mkdirSync(join(UPLOADS, 'sample'), { recursive: true });
  const now = Date.now();
  db.exec('BEGIN');
  try {
    const batchId = Number(db.prepare('INSERT INTO batches (name, created_at) VALUES (?, ?)').run(SAMPLE_BATCH, now).lastInsertRowid);
    const itemId = Number(
      db.prepare("INSERT INTO items (batch_id, design_name, status, updated_at) VALUES (?, 'Sample', 'approved', ?)").run(batchId, now).lastInsertRowid,
    );
    IMAGE_SHADES.forEach((shade, i) => {
      const filePath = `sample/${i + 1}.png`;
      writeFileSync(join(UPLOADS, filePath), solidPng(IMAGE_SIDE, shade));
      db.prepare('INSERT INTO images (item_id, file_path, rank, alt_text) VALUES (?, ?, ?, ?)').run(
        itemId,
        filePath,
        i + 1,
        `Sample image ${i + 1} of ${IMAGE_SHADES.length}, a plain grey square`,
      );
    });
    db.exec('COMMIT');
    return itemId;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

const Money = z.object({ amount: z.int(), divisor: z.int(), currency_code: z.string() });
const money = (m: z.infer<typeof Money>): string => `${(m.amount / (m.divisor || 1)).toFixed(2)} ${m.currency_code}`;
const ListingReadBack = z.object({
  listing_id: z.int(),
  state: z.string(),
  title: z.string(),
  description: z.string(),
  who_made: z.string().nullish(),
  when_made: z.string().nullish(),
  is_supply: z.boolean().nullish(),
  listing_type: z.string().nullish(),
  taxonomy_id: z.int().nullish(),
  shipping_profile_id: z.int().nullish(),
  return_policy_id: z.int().nullish(),
  readiness_state_id: z.int().nullish(),
  tags: z.array(z.string()),
  materials: z.array(z.string()),
  price: Money,
  quantity: z.int(),
  has_variations: z.boolean().nullish(),
  images: z.array(z.object({ listing_image_id: z.int(), rank: z.int(), alt_text: z.string().nullish(), full_width: z.int().nullish() })).nullish(),
});
const InventoryReadBack = z.object({
  products: z.array(
    z.object({
      sku: z.string().nullish(),
      property_values: z.array(
        z.object({ property_id: z.int(), property_name: z.string().nullish(), scale_id: z.int().nullish(), value_ids: z.array(z.int()), values: z.array(z.string()) }),
      ),
      offerings: z.array(z.object({ price: Money, quantity: z.int(), is_enabled: z.boolean(), readiness_state_id: z.int().nullish() })),
    }),
  ),
  price_on_property: z.array(z.int()),
  quantity_on_property: z.array(z.int()),
  sku_on_property: z.array(z.int()),
  readiness_state_on_property: z.array(z.int()).nullish(),
});

async function readBack(etsyFetch: EtsyFetch, listingId: number): Promise<void> {
  const listing = ListingReadBack.parse(await (await etsyFetch(`/v3/application/listings/${listingId}?includes=Images`)).json());
  const inventory = InventoryReadBack.parse(await (await etsyFetch(`/v3/application/listings/${listingId}/inventory`)).json());

  console.log(`\nRead back listing ${listing.listing_id}:`);
  console.log(`  state=${listing.state}  type=${listing.listing_type ?? '?'}  who_made=${listing.who_made ?? '?'}  when_made=${listing.when_made ?? '?'}  is_supply=${listing.is_supply ?? '?'}`);
  console.log(`  title: ${listing.title}`);
  console.log(`  description: ${JSON.stringify(listing.description)}`);
  console.log(`  taxonomy_id=${listing.taxonomy_id ?? '?'}  shipping_profile_id=${listing.shipping_profile_id ?? '?'}  return_policy_id=${listing.return_policy_id ?? '?'}  readiness_state_id=${listing.readiness_state_id ?? '?'}`);
  console.log(`  tags: ${JSON.stringify(listing.tags)}  materials: ${JSON.stringify(listing.materials)}`);
  console.log(`  price (minimum): ${money(listing.price)}  quantity (total): ${listing.quantity}  has_variations=${listing.has_variations ?? '?'}`);
  console.log('  images:');
  for (const image of (listing.images ?? []).toSorted((a, b) => a.rank - b.rank)) {
    console.log(`    rank ${image.rank}  id ${image.listing_image_id}  ${image.full_width ?? '?'}px  alt: ${JSON.stringify(image.alt_text ?? null)}`);
  }
  console.log(`  inventory: price_on=${JSON.stringify(inventory.price_on_property)} quantity_on=${JSON.stringify(inventory.quantity_on_property)} sku_on=${JSON.stringify(inventory.sku_on_property)} readiness_on=${JSON.stringify(inventory.readiness_state_on_property ?? null)}`);
  for (const product of inventory.products) {
    const values = product.property_values.map((v) => `${v.property_name ?? v.property_id}=${v.values.join('/')}[${v.value_ids.join(',')}]${v.scale_id ? ` scale ${v.scale_id}` : ''}`);
    const offers = product.offerings.map((o) => `${money(o.price)} ×${o.quantity}${o.is_enabled ? '' : ' (disabled)'} readiness=${o.readiness_state_id ?? '?'}`);
    console.log(`    ${product.sku ?? '(no sku)'}  ${values.join('  ')}  →  ${offers.join('; ')}`);
  }
  if (listing.state !== 'draft') console.error(`\nWARNING: the listing state is "${listing.state}", not "draft".`);
  console.log(`\nOpen it in Shop Manager: https://www.etsy.com/your/shops/me/listing-editor/edit/${listing.listing_id}`);
}

const db = openDb();
try {
  const store = createSqliteTokenStore(db);
  const shop = store.get();
  if (!shop) throw new NotConnectedError('No shop connected yet. Start the server and open http://localhost:3003/oauth/start');
  const keyed = createEtsyClient({ keystring, sharedSecret, db });
  const etsyFetch = withAuth(keyed, createAccessTokens({ store, keystring, etsyFetch: keyed }));

  const ref = await fetchShopReference(etsyFetch, shop.etsyShopId);
  const tshirt = must(ref.tshirt, 'The T-shirt taxonomy node');
  const size = must(ref.size, 'The size property');
  const sizeScaleId = must(ref.sizeScaleId, 'The letter size scale');
  const color = must(ref.color, 'The color property');
  const processing = must(ref.processingProfiles[0], 'A processing profile');
  const shipping = must(ref.shippingProfiles[0], 'A shipping profile');
  const returns = must(ref.returnPolicies[0], 'A return policy');

  const sizes: SizeOption[] = SIZES.map((s) => {
    const value = must(findValue(size, s.name, sizeScaleId), `Size ${s.name} on scale ${sizeScaleId}`);
    return { name: s.name, etsy: { valueId: value.valueId, name: value.name }, price: s.price };
  });
  const colors: ColorOption[] = COLORS.map((name) => {
    const value = findValue(color, name);
    return { name, etsy: value ? { valueId: value.valueId, name: value.name } : null };
  });

  console.log(`Shop: ${shop.name} (shop_id ${shop.etsyShopId})`);
  console.log(`Taxonomy ${tshirt.id} (${tshirt.path.join(' > ')}); processing ${processing.id} (${processing.label}); shipping ${shipping.id} (${shipping.title}); return policy ${returns.id}`);
  console.log(`Sizes: ${sizes.map((s) => `${s.name}=${s.etsy.valueId}`).join(', ')}; colors: ${colors.map((c) => `${c.name}=${c.etsy ? c.etsy.valueId : 'custom'}`).join(', ')}`);

  const inventory = buildInventory({
    design: 'Sample',
    sizes,
    colors,
    quantity: QUANTITY,
    skuPattern: SKU_PATTERN,
    readinessStateId: processing.id,
    sizePropertyId: size.propertyId,
    sizePropertyName: size.name,
    sizeScaleId,
    colorPropertyId: color.propertyId,
    colorPropertyName: color.name,
  });
  if (!inventory.ok) throw new Error(`Inventory problems: ${inventory.problems.map((p) => `${p.field} ${p.reason}`).join('; ')}`);

  const listing: DraftListing = {
    title: 'Sample Listing Test Draft',
    description: 'Test draft made by the Etsy Listing Assistant to check photos, variations and prices. Not for sale; it will be deleted.',
    price: Math.min(...sizes.map((s) => s.price)),
    quantity: QUANTITY,
    taxonomyId: tshirt.id,
    shippingProfileId: shipping.id,
    returnPolicyId: returns.id,
    readinessStateId: processing.id,
    shopSectionId: null,
    tags: ['sample', 'test draft'],
    materials: ['cotton'],
    itemSize: ITEM_SIZE,
  };

  const itemId = sampleItem(db);
  const publish = createPublisher({
    db,
    etsyFetch,
    shopId: shop.etsyShopId,
    readImage: async (filePath) => new File([readFileSync(join(UPLOADS, filePath))], filePath.split('/').pop() ?? 'image.png', { type: 'image/png' }),
  });
  const listingId = await publish(itemId, { listing, inventory: inventory.payload });
  console.log(`\nDraft pushed: listing ${listingId} (item ${itemId})`);
  await readBack(etsyFetch, listingId);
} catch (error) {
  if (error instanceof EtsyError || error instanceof NotConnectedError || error instanceof PublishError) {
    console.error(error.message);
  } else {
    console.error('Publishing the sample draft failed:', error);
  }
  process.exitCode = 1;
} finally {
  db.close();
}
