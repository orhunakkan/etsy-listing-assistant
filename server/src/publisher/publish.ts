// Turns one item into an Etsy draft, resumably (SPEC.md → Pushing without duplicates):
//   1. save push_started_at, create the draft, save etsy_listing_id (push_step 'created')
//   2. upload each image by rank with overwrite=true, saving its id (push_step 'image:<rank>')
//   3. send the inventory (push_step 'inventory')
// push_step names the last finished step, and a retry starts after it. If the server died
// between creating the draft and saving its id, a retry adopts that draft instead of
// creating a second one. Once etsy_listing_id is saved, no retry creates again.
import type { DatabaseSync } from 'node:sqlite';
import type { EtsyFetch } from '../etsy/client.ts';
import {
  comparableTitle,
  createDraftListing,
  type DraftListing,
  listDrafts,
  updateListingInventory,
  uploadListingImage,
} from '../etsy/listings.ts';
import type { InventoryPayload } from './inventory.ts';

// Etsy's created_timestamp is in whole seconds and comes from Etsy's clock, not ours;
// a draft created up to this long before push_started_at still counts as ours.
const CLOCK_SKEW_MS = 60_000;

export type PushContent = { listing: DraftListing; inventory: InventoryPayload };

export type PublisherOptions = {
  db: DatabaseSync;
  etsyFetch: EtsyFetch; // with the shop's OAuth token (withAuth)
  shopId: number;
  readImage: (filePath: string) => Promise<File>; // file_path is relative to data/uploads
  now?: () => number;
};

type PushState = { etsyListingId: number | null; pushStartedAt: number | null; pushStep: string | null };
type ImageRow = { id: number; rank: number; filePath: string; altText: string | null };

export class PublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublishError';
  }
}

// The rank of the last uploaded image: 0 right after 'created', null once the push is done.
export function lastImageRank(pushStep: string | null): number | null {
  if (pushStep === 'inventory') return null;
  if (pushStep === null || pushStep === 'created') return 0;
  const match = /^image:(\d+)$/.exec(pushStep);
  if (!match?.[1]) throw new PublishError(`Unknown push_step "${pushStep}"`);
  return Number(match[1]);
}

// Returns publish(itemId, content), which resolves with the Etsy listing id. Pushes of
// the same item never overlap; callers queue items one at a time anyway.
export function createPublisher(options: PublisherOptions): (itemId: number, content: PushContent) => Promise<number> {
  const { db, etsyFetch, shopId, readImage, now = Date.now } = options;
  const inFlight = new Set<number>();

  const readState = db.prepare('SELECT etsy_listing_id, push_started_at, push_step FROM items WHERE id = ?');
  const readImages = db.prepare('SELECT id, rank, file_path, alt_text FROM images WHERE item_id = ? ORDER BY rank');
  const saveStart = db.prepare('UPDATE items SET push_started_at = ?, updated_at = ? WHERE id = ?');
  const saveListing = db.prepare("UPDATE items SET etsy_listing_id = ?, push_step = 'created', updated_at = ? WHERE id = ?");
  const saveStep = db.prepare('UPDATE items SET push_step = ?, updated_at = ? WHERE id = ?');
  const saveImageId = db.prepare('UPDATE images SET etsy_image_id = ? WHERE id = ?');

  function state(itemId: number): PushState {
    const row = readState.get(itemId);
    if (row === undefined) throw new PublishError(`Item ${itemId} does not exist`);
    const int = (value: unknown): number | null => (typeof value === 'number' ? value : null);
    const pushStep = row['push_step'];
    return {
      etsyListingId: int(row['etsy_listing_id']),
      pushStartedAt: int(row['push_started_at']),
      pushStep: typeof pushStep === 'string' ? pushStep : null,
    };
  }

  function images(itemId: number): ImageRow[] {
    const rows = readImages.all(itemId).map((row) => ({
      id: Number(row['id']),
      rank: Number(row['rank']),
      filePath: String(row['file_path']),
      altText: typeof row['alt_text'] === 'string' ? row['alt_text'] : null,
    }));
    // A retry resumes by rank, so ranks must be exactly 1..n.
    rows.forEach((image, i) => {
      if (image.rank !== i + 1) throw new PublishError(`Item ${itemId}'s image ranks are not 1..${rows.length}`);
    });
    return rows;
  }

  // The draft an earlier attempt created before it could save the id, if any.
  async function findEarlierDraft(title: string, startedAt: number): Promise<number | undefined> {
    const wanted = comparableTitle(title);
    const matches = (await listDrafts(etsyFetch, shopId))
      .filter((d) => comparableTitle(d.title) === wanted && d.createdAt >= startedAt - CLOCK_SKEW_MS)
      .toSorted((a, b) => a.createdAt - b.createdAt);
    return matches[0]?.listingId;
  }

  async function push(itemId: number, content: PushContent): Promise<number> {
    let current = state(itemId);
    if (current.pushStep === 'inventory' && current.etsyListingId !== null) return current.etsyListingId;
    const itemImages = images(itemId);

    let listingId = current.etsyListingId;
    if (listingId === null) {
      if (current.pushStartedAt !== null) listingId = await findEarlierDraft(content.listing.title, current.pushStartedAt) ?? null;
      if (listingId === null) {
        saveStart.run(now(), now(), itemId);
        listingId = await createDraftListing(etsyFetch, shopId, content.listing);
      }
      saveListing.run(listingId, now(), itemId);
      current = state(itemId);
    }

    const after = lastImageRank(current.pushStep) ?? itemImages.length;
    for (const image of itemImages.filter((i) => i.rank > after)) {
      const file = await readImage(image.filePath);
      const imageId = await uploadListingImage(etsyFetch, shopId, listingId, { image: file, rank: image.rank, altText: image.altText });
      saveImageId.run(imageId, image.id);
      saveStep.run(`image:${image.rank}`, now(), itemId);
    }

    await updateListingInventory(etsyFetch, listingId, content.inventory);
    saveStep.run('inventory', now(), itemId);
    return listingId;
  }

  return async (itemId, content) => {
    if (inFlight.has(itemId)) throw new PublishError(`Item ${itemId} is already being pushed`);
    inFlight.add(itemId);
    try {
      return await push(itemId, content);
    } finally {
      inFlight.delete(itemId);
    }
  };
}
