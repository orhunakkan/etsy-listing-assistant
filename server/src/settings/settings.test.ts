import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, it } from 'node:test';
import { createApp } from '../app.ts';
import { openDb } from '../db.ts';
import { EtsyError } from '../etsy/client.ts';
import type { ShopReference } from '../etsy/reference.ts';
import { NotConnectedError } from '../etsy/token-store.ts';
import { createReferenceCache, type ReferenceSource } from './routes.ts';
import { loadSettings, saveSettings, type Settings, validateSettings } from './settings.ts';

// Ids are made up; real ones come from the shop reference data at runtime.
const valid: Settings = {
  etsy: { taxonomyId: 482, sizePropertyId: 9001, sizePropertyName: 'Size', sizeScaleId: 51, colorPropertyId: 200, colorPropertyName: 'Primary color' },
  sizes: [
    { name: 'S', etsy: { valueId: 11, name: 'S' }, price: 25.98 },
    { name: '2XL', etsy: { valueId: 15, name: '2X' }, price: 28.98 },
  ],
  colors: [
    { name: 'Black', etsy: { valueId: 1, name: 'Black' } },
    { name: 'Sport Grey', etsy: null },
  ],
  quantity: 999,
  skuPattern: '{design}-{size}-{color}',
  itemSize: { weight: 4, weightUnit: 'oz', length: 10, width: 10, height: 1, dimensionsUnit: 'in' },
  listing: { shippingProfileId: 1, returnPolicyId: 2, readinessStateId: 3, shopSectionId: null },
  materials: ['Cotton'],
  footer: 'CARE INSTRUCTIONS\n\nTurn the shirt inside out before washing.',
  voice: 'Warm and playful.',
  bannedTerms: ['disney'],
};

function errors(input: unknown): string[] {
  const result = validateSettings(input);
  if (result.ok) assert.fail('expected errors');
  return result.errors.map((e) => `${e.field}: ${e.reason}`);
}

describe('validateSettings', () => {
  it('accepts complete settings', () => {
    assert.deepEqual(validateSettings(valid), { ok: true, settings: valid });
  });

  it('drops unknown fields', () => {
    const result = validateSettings({ ...valid, extra: 'x' });
    assert.ok(result.ok);
    assert.equal('extra' in result.settings, false);
  });

  it('reports schema errors by field path', () => {
    const bad = { ...valid, quantity: 'lots', itemSize: { ...valid.itemSize, weightUnit: 'stone' }, listing: { ...valid.listing, shippingProfileId: undefined } };
    const fields = errors(bad).map((e) => e.split(':')[0]);
    assert.deepEqual(fields.toSorted(), ['itemSize.weightUnit', 'listing.shippingProfileId', 'quantity']);
  });

  it('reports text rule errors alongside schema errors, so one save shows everything', () => {
    const colors = [{ name: 'Daisy (Yellow)', etsy: null }];
    const sizes = [{ name: 'S', etsy: { valueId: 11, name: 'S' }, price: null }];
    assert.deepEqual(errors({ ...valid, quantity: null, sizes, colors, materials: ['100% cotton'], footer: '' }), [
      'sizes[0].price: is required',
      'quantity: is required',
      'colors[0].name: contains parentheses, which Etsy does not allow',
      'materials[0]: contains characters Etsy does not allow: "%"',
      'footer: is empty',
    ]);
  });

  it('rejects a body that is not an object', () => {
    assert.deepEqual(errors(null).length, 1);
  });

  it('reports rule errors in color names and Etsy color values', () => {
    const colors = [
      { name: 'Grey (Heather)', etsy: null },
      { name: 'White', etsy: { valueId: 2, name: ' ' } },
    ];
    assert.deepEqual(errors({ ...valid, colors }), [
      'colors[0].name: contains parentheses, which Etsy does not allow',
      'colors[1].etsy.name: is empty',
    ]);
  });

  it('needs at least one size and one color', () => {
    assert.deepEqual(errors({ ...valid, sizes: [], colors: [] }), ['sizes: needs at least one value', 'colors: needs at least one value']);
  });

  it('reports an empty footer', () => {
    assert.deepEqual(errors({ ...valid, footer: '  \n ' }), ['footer: is empty']);
  });

  it('reports rule errors in materials and banned terms', () => {
    assert.deepEqual(errors({ ...valid, materials: ['100% cotton'], bannedTerms: ['nike', ''] }), [
      'materials[0]: contains characters Etsy does not allow: "%"',
      'bannedTerms[1]: is empty',
    ]);
  });

  it('reports inventory problems: price, quantity and SKU pattern', () => {
    const sizes = [{ name: 'S', etsy: { valueId: 11, name: 'S' }, price: 25.999 }];
    assert.deepEqual(errors({ ...valid, sizes, quantity: 0, skuPattern: '{design}-{fit}' }), [
      'sizes[0].price: 25.999 is not a positive price in cents',
      'quantity: 0 is not a whole number of at least 1',
      'skuPattern: {fit} is not one of {design}, {size}, {color}',
    ]);
  });
});

describe('loadSettings / saveSettings', () => {
  it('round-trips and replaces the single row', () => {
    const db = openDb(':memory:');
    assert.equal(loadSettings(db), undefined);
    saveSettings(db, valid, 1000);
    saveSettings(db, { ...valid, quantity: 5 }, 2000);
    assert.deepEqual(loadSettings(db), { settings: { ...valid, quantity: 5 }, updatedAt: 2000 });
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM settings').get()?.['n'], 1);
  });
});

const reference: ShopReference = {
  shippingProfiles: [{ id: 1, title: 'Standard', originCountry: 'US' }],
  returnPolicies: [{ id: 2, acceptsReturns: false, acceptsExchanges: false, returnDeadlineDays: null }],
  processingProfiles: [{ id: 3, readinessState: 'made_to_order', label: '1-2 days' }],
  sections: [],
  tshirtCandidates: [],
  tshirt: { id: 482, path: ['Clothing', 'T-shirts'] },
  variationProperties: [],
  size: undefined,
  sizeScaleId: undefined,
  color: undefined,
};

describe('createReferenceCache', () => {
  it('loads once, shares a fetch in flight, and reloads on refresh', async () => {
    let loads = 0;
    const cache = createReferenceCache(async () => {
      loads++;
      return reference;
    });
    await Promise.all([cache.get(), cache.get()]);
    await cache.get();
    assert.equal(loads, 1);
    await cache.refresh();
    await cache.get();
    assert.equal(loads, 2);
  });

  it('does not cache a failure', async () => {
    let loads = 0;
    const cache = createReferenceCache(async () => {
      loads++;
      if (loads === 1) throw new Error('Etsy down');
      return reference;
    });
    await assert.rejects(cache.get(), /Etsy down/);
    assert.deepEqual(await cache.get(), reference);
  });
});

const BASE = 'http://localhost:3003';

describe('/api/settings', () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = openDb(':memory:');
  });
  const put = (body: string, contentType = 'application/json') =>
    createApp({ db, reference: undefined }).request(`${BASE}/api/settings`, { method: 'PUT', body, headers: { 'content-type': contentType } });

  it('returns null before anything is saved', async () => {
    const res = await createApp({ db }).request(`${BASE}/api/settings`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { settings: null, updatedAt: null });
  });

  it('saves valid settings and serves them back', async () => {
    const saved = await put(JSON.stringify(valid));
    assert.equal(saved.status, 200);
    const res = await createApp({ db }).request(`${BASE}/api/settings`);
    const body: unknown = await res.json();
    assert.deepEqual(body, { settings: valid, updatedAt: loadSettings(db)?.updatedAt });
  });

  it('returns field errors and saves nothing', async () => {
    const res = await put(JSON.stringify({ ...valid, footer: '' }));
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { errors: [{ field: 'footer', reason: 'is empty' }] });
    assert.equal(loadSettings(db), undefined);
  });

  it('rejects invalid JSON and non-JSON bodies', async () => {
    assert.equal((await put('{nope')).status, 400);
    assert.equal((await put('footer=x', 'application/x-www-form-urlencoded')).status, 415);
  });

  it('is blocked for a foreign origin', async () => {
    const res = await createApp({ db }).request(`${BASE}/api/settings`, {
      method: 'PUT',
      body: JSON.stringify(valid),
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
    });
    assert.equal(res.status, 403);
    assert.equal(loadSettings(db), undefined);
  });
});

describe('/api/reference', () => {
  const app = (source: ReferenceSource | undefined) => createApp({ db: openDb(':memory:'), reference: source });
  const failing = (error: Error): ReferenceSource => ({ get: () => Promise.reject(error), refresh: () => Promise.reject(error) });

  it('serves the cached reference data and refreshes on POST', async () => {
    let loads = 0;
    const source = createReferenceCache(async () => {
      loads++;
      return reference;
    });
    const res = await app(source).request(`${BASE}/api/reference`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), JSON.parse(JSON.stringify(reference)));
    assert.equal((await app(source).request(`${BASE}/api/reference/refresh`, { method: 'POST' })).status, 200);
    assert.equal(loads, 2);
  });

  it('maps failures to status codes without details', async () => {
    assert.equal((await app(undefined).request(`${BASE}/api/reference`)).status, 503);
    assert.equal((await app(failing(new NotConnectedError('no shop'))).request(`${BASE}/api/reference`)).status, 409);
    const res = await app(failing(new EtsyError(500, '/v3/x', 'boom'))).request(`${BASE}/api/reference`);
    assert.equal(res.status, 502);
    assert.doesNotMatch(await res.text(), /boom/);
  });
});
