// The Etsy listing endpoints the draft publisher uses. Shapes follow the OpenAPI spec
// (createDraftListing, getListingsByShop, uploadListingImage, updateListingInventory).
// `etsyFetch` must carry the shop's OAuth token (withAuth): writes need listings_w.
import { z } from 'zod';
import type { InventoryPayload } from '../publisher/inventory.ts';
import type { EtsyFetch } from './client.ts';

const PAGE_LIMIT = 100; // getListingsByShop's maximum
const MAX_PAGES = 50; // 5,000 drafts; beyond that adoption can't be trusted, so it fails

// Fixed listing facts (SPEC.md → Assumptions 3).
const FIXED_FIELDS = { who_made: 'i_did', when_made: 'made_to_order', type: 'physical', is_supply: 'false' } as const;

export type DraftListing = {
  title: string;
  description: string;
  price: number; // the lowest size price; the inventory call sets the real ones
  quantity: number;
  taxonomyId: number;
  shippingProfileId: number;
  returnPolicyId: number;
  readinessStateId: number; // the processing profile
  shopSectionId: number | null;
  tags: readonly string[];
  materials: readonly string[];
  itemSize: ItemSize | null; // required when the shipping profile is calculated
};

// The packed item's weight and dimensions. Etsy refuses a calculated shipping profile
// without all six fields (HTTP 400 seen live in T9).
export type ItemSize = {
  weight: number;
  weightUnit: 'oz' | 'lb' | 'g' | 'kg';
  length: number;
  width: number;
  height: number;
  dimensionsUnit: 'in' | 'ft' | 'mm' | 'cm' | 'm' | 'yd';
};

export type DraftSummary = { listingId: number; title: string; createdAt: number }; // createdAt in epoch ms

const CreatedListing = z.object({ listing_id: z.int() });
const Listings = z.object({
  count: z.int(),
  results: z.array(z.object({ listing_id: z.int(), title: z.string(), created_timestamp: z.int() })),
});
const UploadedImage = z.object({ listing_image_id: z.int() });

// Array fields go as one comma-separated value (Etsy listings tutorial: image_ids), so an
// element containing a comma would silently become two.
function joinList(field: string, values: readonly string[]): string {
  const bad = values.find((v) => v.includes(','));
  if (bad !== undefined) throw new Error(`${field} entry "${bad}" contains a comma`);
  return values.join(',');
}

export async function createDraftListing(etsyFetch: EtsyFetch, shopId: number, listing: DraftListing): Promise<number> {
  const body = new URLSearchParams({
    ...FIXED_FIELDS,
    title: listing.title,
    description: listing.description,
    price: String(listing.price),
    quantity: String(listing.quantity),
    taxonomy_id: String(listing.taxonomyId),
    shipping_profile_id: String(listing.shippingProfileId),
    return_policy_id: String(listing.returnPolicyId),
    readiness_state_id: String(listing.readinessStateId),
  });
  if (listing.shopSectionId !== null) body.set('shop_section_id', String(listing.shopSectionId));
  if (listing.tags.length > 0) body.set('tags', joinList('tags', listing.tags));
  if (listing.materials.length > 0) body.set('materials', joinList('materials', listing.materials));
  if (listing.itemSize !== null) {
    const { weight, weightUnit, length, width, height, dimensionsUnit } = listing.itemSize;
    body.set('item_weight', String(weight));
    body.set('item_weight_unit', weightUnit);
    body.set('item_length', String(length));
    body.set('item_width', String(width));
    body.set('item_height', String(height));
    body.set('item_dimensions_unit', dimensionsUnit);
  }

  const res = await etsyFetch(`/v3/application/shops/${shopId}/listings`, { method: 'POST', body });
  return CreatedListing.parse(await res.json()).listing_id;
}

// Every draft in the shop. getListingsByShop can't sort without a search option, so
// this reads all pages.
export async function listDrafts(etsyFetch: EtsyFetch, shopId: number): Promise<DraftSummary[]> {
  const drafts: DraftSummary[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const query = new URLSearchParams({ state: 'draft', limit: String(PAGE_LIMIT), offset: String(page * PAGE_LIMIT) });
    const { count, results } = Listings.parse(await (await etsyFetch(`/v3/application/shops/${shopId}/listings?${query}`)).json());
    drafts.push(...results.map((l) => ({ listingId: l.listing_id, title: l.title, createdAt: l.created_timestamp * 1000 })));
    if (results.length < PAGE_LIMIT || drafts.length >= count) return drafts;
  }
  throw new Error(`The shop has more than ${MAX_PAGES * PAGE_LIMIT} drafts; too many to check for an earlier push`);
}

export type ListingImageUpload = { image: File; rank: number; altText: string | null };

// With overwrite=true the image replaces whatever is at `rank`, so a retry never adds a copy.
export async function uploadListingImage(
  etsyFetch: EtsyFetch,
  shopId: number,
  listingId: number,
  upload: ListingImageUpload,
): Promise<number> {
  const body = new FormData();
  body.set('image', upload.image);
  body.set('rank', String(upload.rank));
  body.set('overwrite', 'true');
  if (upload.altText !== null) body.set('alt_text', upload.altText);
  const res = await etsyFetch(`/v3/application/shops/${shopId}/listings/${listingId}/images`, { method: 'POST', body });
  return UploadedImage.parse(await res.json()).listing_image_id;
}

// Replaces the whole inventory, so sending it twice does no harm.
export async function updateListingInventory(etsyFetch: EtsyFetch, listingId: number, payload: InventoryPayload): Promise<void> {
  const res = await etsyFetch(`/v3/application/listings/${listingId}/inventory`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  await res.body?.cancel();
}

const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };

// Titles as Etsy returns them can carry HTML entities (&#39;, &amp;) and different
// spacing; this is the form two titles are compared in.
export function comparableTitle(title: string): string {
  return title
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
      if (code.startsWith('#')) {
        const n = code[1] === 'x' || code[1] === 'X' ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1));
        return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
      }
      return ENTITIES[code.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, ' ')
    .trim();
}
