import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, it } from 'node:test';
import { openDb } from '../db.ts';
import { createEtsyClient, type EtsyFetch } from '../etsy/client.ts';
import { comparableTitle, type DraftListing } from '../etsy/listings.ts';
import type { InventoryPayload } from './inventory.ts';
import { createPublisher, lastImageRank, PublishError, type PushContent } from './publish.ts';

const SHOP = 42;
const ITEM = 1;
const IMAGES = 5;

// A crash point: the request either never reaches Etsy, or Etsy does the work and the
// response is lost (the server dies before it can save the result).
type Step = 'create' | `image:${number}` | 'inventory';
type Crash = { at: Step; etsyDidIt: boolean };

type FakeDraft = { listingId: number; title: string; createdTimestamp: number; images: Map<number, number>; inventory: unknown };

// An in-memory Etsy shop that answers the four publisher endpoints.
function fakeEtsy(clock: { now: number }) {
  const drafts = new Map<number, FakeDraft>();
  const log: string[] = []; // the steps Etsy carried out, in order
  const created: URLSearchParams[] = [];
  const uploads: Array<{ rank: string; overwrite: string; altText: string | null; name: string }> = [];
  let nextId = 1000;
  let crash: Crash | null = null;

  const json = (body: unknown): Response => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

  // Runs `work` unless the crash point says the request never arrived; throws if the
  // response is to be lost.
  function step<T>(name: Step, work: () => T): T {
    const hit = crash?.at === name ? crash : null;
    if (hit) crash = null;
    if (hit && !hit.etsyDidIt) throw new TypeError('fetch failed');
    const result = work();
    log.push(name);
    if (hit) throw new TypeError('fetch failed');
    return result;
  }

  const fetch = async (url: string, init: RequestInit): Promise<Response> => {
    const { pathname, searchParams } = new URL(url);
    const method = init.method ?? 'GET';
    let m: RegExpExecArray | null;
    if (method === 'POST' && pathname === `/v3/application/shops/${SHOP}/listings`) {
      assert.ok(init.body instanceof URLSearchParams);
      const body = init.body;
      return step('create', () => {
        const listingId = nextId++;
        created.push(body);
        drafts.set(listingId, { listingId, title: body.get('title') ?? '', createdTimestamp: Math.floor(clock.now / 1000), images: new Map(), inventory: null });
        return json({ listing_id: listingId, state: 'draft' });
      });
    }
    if (method === 'GET' && pathname === `/v3/application/shops/${SHOP}/listings`) {
      assert.equal(searchParams.get('state'), 'draft');
      const all = [...drafts.values()];
      const offset = Number(searchParams.get('offset'));
      const page = all.slice(offset, offset + Number(searchParams.get('limit')));
      // Etsy returns titles HTML-escaped.
      const results = page.map((d) => ({ listing_id: d.listingId, title: d.title.replaceAll("'", '&#39;'), created_timestamp: d.createdTimestamp }));
      return json({ count: all.length, results });
    }
    if (method === 'POST' && (m = /^\/v3\/application\/shops\/42\/listings\/(\d+)\/images$/.exec(pathname))) {
      assert.ok(init.body instanceof FormData);
      const form = init.body;
      const draft = drafts.get(Number(m[1]));
      assert.ok(draft, 'upload to an unknown listing');
      const rank = String(form.get('rank'));
      return step(`image:${Number(rank)}`, () => {
        const image = form.get('image');
        assert.ok(image instanceof File);
        const altText = form.get('alt_text');
        uploads.push({ rank, overwrite: String(form.get('overwrite')), altText: typeof altText === 'string' ? altText : null, name: image.name });
        const imageId = nextId++;
        draft.images.set(Number(rank), imageId); // overwrite=true replaces the image at that rank
        return json({ listing_image_id: imageId, rank: Number(rank) });
      });
    }
    if (method === 'PUT' && (m = /^\/v3\/application\/listings\/(\d+)\/inventory$/.exec(pathname))) {
      const draft = drafts.get(Number(m[1]));
      assert.ok(draft, 'inventory for an unknown listing');
      return step('inventory', () => {
        draft.inventory = JSON.parse(String(init.body));
        return json({ products: [] });
      });
    }
    throw new Error(`fakeEtsy: unexpected ${method} ${pathname}`);
  };

  return {
    fetch,
    drafts,
    log,
    created,
    uploads,
    crashAt: (at: Step, etsyDidIt: boolean) => void (crash = { at, etsyDidIt }),
    addDraft: (title: string, createdTimestamp: number) => {
      const listingId = nextId++;
      drafts.set(listingId, { listingId, title, createdTimestamp, images: new Map(), inventory: null });
      return listingId;
    },
  };
}

const listing: DraftListing = {
  title: "Sample Listing Test Draft, Mom's Tee",
  description: 'A harmless test draft.',
  price: 22,
  quantity: 10,
  taxonomyId: 482,
  shippingProfileId: 7,
  returnPolicyId: 8,
  readinessStateId: 9,
  shopSectionId: null,
  tags: ['sample tag', 'test draft'],
  materials: ['cotton'],
};
const inventory: InventoryPayload = {
  products: [],
  price_on_property: [1],
  quantity_on_property: [],
  sku_on_property: [],
  readiness_state_on_property: [],
};
const content: PushContent = { listing, inventory };

function seed(db: DatabaseSync, imageCount = IMAGES): void {
  db.prepare("INSERT INTO batches (id, name, created_at) VALUES (1, 'batch', 0)").run();
  db.prepare("INSERT INTO items (id, batch_id, design_name, status, updated_at) VALUES (?, 1, 'design', 'approved', 0)").run(ITEM);
  for (let rank = 1; rank <= imageCount; rank++) {
    db.prepare('INSERT INTO images (item_id, file_path, rank, alt_text) VALUES (?, ?, ?, ?)').run(ITEM, `b/d/${rank}.png`, rank, `alt ${rank}`);
  }
}

function itemRow(db: DatabaseSync) {
  const row = db.prepare('SELECT etsy_listing_id, push_started_at, push_step FROM items WHERE id = ?').get(ITEM);
  return { ...row };
}

describe('publish', () => {
  let db: DatabaseSync;
  let clock: { now: number };
  let etsy: ReturnType<typeof fakeEtsy>;
  let etsyFetch: EtsyFetch;
  // A fresh publisher per attempt, as after a server restart.
  const publish = (itemId = ITEM) =>
    createPublisher({
      db,
      etsyFetch,
      shopId: SHOP,
      now: () => clock.now,
      readImage: async (path) => new File([new Uint8Array([0x89, 0x50])], path.split('/').pop() ?? 'x', { type: 'image/png' }),
    })(itemId, content);

  beforeEach(() => {
    db = openDb(':memory:');
    seed(db);
    clock = { now: 1_800_000_000_000 };
    etsy = fakeEtsy(clock);
    etsyFetch = createEtsyClient({
      keystring: 'k',
      sharedSecret: 's',
      db,
      fetch: etsy.fetch,
      throttle: (task) => task(),
      clock: { now: () => clock.now, sleep: async () => {} },
    });
  });

  // Exactly one draft, with every image once and the inventory set.
  function assertOneCompleteDraft(listingId: number): void {
    assert.equal(etsy.drafts.size, 1);
    const draft = etsy.drafts.get(listingId);
    assert.ok(draft);
    assert.deepEqual([...draft.images.keys()].toSorted(), [1, 2, 3, 4, 5]);
    assert.deepEqual(draft.inventory, inventory);
    assert.deepEqual(itemRow(db), { etsy_listing_id: listingId, push_started_at: clock.now, push_step: 'inventory' });
    const imageIds = db.prepare('SELECT rank, etsy_image_id FROM images WHERE item_id = ? ORDER BY rank').all(ITEM);
    assert.deepEqual(imageIds.map((r) => r['etsy_image_id']), [1, 2, 3, 4, 5].map((rank) => draft.images.get(rank)));
  }

  it('creates the draft, uploads images in rank order and sets the inventory', async () => {
    const listingId = await publish();
    assert.deepEqual(etsy.log, ['create', 'image:1', 'image:2', 'image:3', 'image:4', 'image:5', 'inventory']);
    assertOneCompleteDraft(listingId);

    const sent = etsy.created[0];
    assert.ok(sent);
    assert.deepEqual(Object.fromEntries(sent), {
      who_made: 'i_did',
      when_made: 'made_to_order',
      type: 'physical',
      is_supply: 'false',
      title: listing.title,
      description: listing.description,
      price: '22',
      quantity: '10',
      taxonomy_id: '482',
      shipping_profile_id: '7',
      return_policy_id: '8',
      readiness_state_id: '9',
      tags: 'sample tag,test draft',
      materials: 'cotton',
    });
    assert.deepEqual(etsy.uploads[0], { rank: '1', overwrite: 'true', altText: 'alt 1', name: '1.png' });
  });

  it('does nothing when the item is already pushed', async () => {
    await publish();
    const calls = etsy.log.length;
    await publish();
    assert.equal(etsy.log.length, calls);
  });

  it('adopts the draft when the server died before saving the listing id', async () => {
    etsy.crashAt('create', true);
    await assert.rejects(publish(), /fetch failed/);
    assert.equal(itemRow(db)['etsy_listing_id'], null);
    assert.equal(itemRow(db)['push_started_at'], clock.now);

    clock.now += 5_000;
    const listingId = await publish();
    assert.equal(etsy.created.length, 1);
    clock.now -= 5_000; // push_started_at is from the first attempt
    assertOneCompleteDraft(listingId);
  });

  it('creates a new draft when the create never reached Etsy', async () => {
    etsy.crashAt('create', false);
    await assert.rejects(publish(), /fetch failed/);
    const listingId = await publish();
    assert.equal(etsy.created.length, 1);
    assertOneCompleteDraft(listingId);
  });

  it('does not adopt an older draft with the same title, or a newer one with another title', async () => {
    etsy.addDraft(listing.title, Math.floor(clock.now / 1000) - 3600); // made by hand an hour earlier
    etsy.crashAt('create', false);
    await assert.rejects(publish(), /fetch failed/);
    etsy.addDraft('Another Listing', Math.floor(clock.now / 1000));

    const listingId = await publish();
    assert.equal(etsy.created.length, 1);
    assert.equal(etsy.drafts.get(listingId)?.title, listing.title);
    assert.equal(etsy.drafts.size, 3);
  });

  it('resumes after image:3 with images 4 and 5 only', async () => {
    etsy.crashAt('image:4', false);
    await assert.rejects(publish(), /fetch failed/);
    assert.equal(itemRow(db)['push_step'], 'image:3');

    const listingId = await publish();
    assert.deepEqual(etsy.log, ['create', 'image:1', 'image:2', 'image:3', 'image:4', 'image:5', 'inventory']);
    assertOneCompleteDraft(listingId);
  });

  it('re-sends an image whose response was lost, replacing it at the same rank', async () => {
    etsy.crashAt('image:4', true);
    await assert.rejects(publish(), /fetch failed/);
    assert.equal(itemRow(db)['push_step'], 'image:3');

    const listingId = await publish();
    assert.deepEqual(etsy.uploads.map((u) => u.rank), ['1', '2', '3', '4', '4', '5']);
    assert.ok(etsy.uploads.every((u) => u.overwrite === 'true'));
    assert.equal(etsy.created.length, 1);
    assertOneCompleteDraft(listingId);
  });

  it('resumes before inventory without creating or uploading again', async () => {
    etsy.crashAt('inventory', false);
    await assert.rejects(publish(), /fetch failed/);
    assert.equal(itemRow(db)['push_step'], 'image:5');

    const listingId = await publish();
    assert.deepEqual(etsy.log, ['create', 'image:1', 'image:2', 'image:3', 'image:4', 'image:5', 'inventory']);
    assertOneCompleteDraft(listingId);
  });

  it('refuses image ranks that are not 1..n, before any call', async () => {
    db.prepare('UPDATE images SET rank = 9 WHERE item_id = ? AND rank = 5').run(ITEM);
    await assert.rejects(publish(), (error) => error instanceof PublishError && /not 1\.\.5/.test(error.message));
    assert.deepEqual(etsy.log, []);
  });

  it('refuses an unknown item', async () => {
    await assert.rejects(publish(99), (error) => error instanceof PublishError && /does not exist/.test(error.message));
  });

  it('refuses a second push of the same item while one is running', async () => {
    const run = createPublisher({ db, etsyFetch, shopId: SHOP, readImage: async () => new File([], 'x.png') });
    const first = run(ITEM, content);
    await assert.rejects(run(ITEM, content), /already being pushed/);
    await first;
    assert.equal(etsy.created.length, 1);
  });

  it('refuses a tag with a comma, which Etsy would split in two', async () => {
    const bad: PushContent = { listing: { ...listing, tags: ['one, two'] }, inventory };
    const run = createPublisher({ db, etsyFetch, shopId: SHOP, readImage: async () => new File([], 'x.png') });
    await assert.rejects(run(ITEM, bad), /contains a comma/);
    assert.equal(etsy.created.length, 0);
  });
});

describe('lastImageRank', () => {
  const cases: Array<[string | null, number | null]> = [
    [null, 0],
    ['created', 0],
    ['image:3', 3],
    ['inventory', null],
  ];
  for (const [step, rank] of cases) {
    it(`${JSON.stringify(step)} → ${rank}`, () => assert.equal(lastImageRank(step), rank));
  }
  it('rejects an unknown step', () => assert.throws(() => lastImageRank('images'), PublishError));
});

describe('comparableTitle', () => {
  const cases: Array<[string, string]> = [
    ['Mom&#39;s Tee', "Mom's Tee"],
    ['Salt &amp; Pepper', 'Salt & Pepper'],
    ['Caf&#xE9;  Tee ', 'Café Tee'],
    ['&bogus; stays', '&bogus; stays'],
  ];
  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} → ${JSON.stringify(expected)}`, () => assert.equal(comparableTitle(input), expected));
  }
});
