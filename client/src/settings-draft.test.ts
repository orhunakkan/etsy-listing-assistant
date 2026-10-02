import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Settings, ShopReference } from './api.ts';
import { DEFAULT_SKU_PATTERN, draftFromSettings, emptyDraft, errorsAt, errorsUnder, toSettings } from './settings-draft.ts';

// Ids are made up; real ones come from /api/reference.
const reference: ShopReference = {
  shippingProfiles: [{ id: 1, title: 'Standard', originCountry: 'US' }],
  returnPolicies: [
    { id: 2, acceptsReturns: false, acceptsExchanges: false, returnDeadlineDays: null },
    { id: 22, acceptsReturns: true, acceptsExchanges: true, returnDeadlineDays: 30 },
  ],
  processingProfiles: [{ id: 3, readinessState: 'made_to_order', label: '1-2 days' }],
  sections: [{ id: 4, title: 'DISNEY' }],
  tshirtCandidates: [{ id: 482, path: ['Clothing', 'T-shirts'] }],
  tshirt: { id: 482, path: ['Clothing', 'T-shirts'] },
  size: {
    propertyId: 9001,
    name: 'Size',
    scales: [{ scaleId: 51, name: 'Letter' }],
    values: [
      { valueId: 11, name: 'S', scaleId: 51 },
      { valueId: 15, name: '2X', scaleId: 51 },
    ],
  },
  sizeScaleId: 51,
  color: { propertyId: 200, name: 'Primary color', scales: [], values: [{ valueId: 1, name: 'Black', scaleId: null }] },
};

const settings: Settings = {
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
  listing: { shippingProfileId: 1, returnPolicyId: 2, readinessStateId: 3, shopSectionId: 4 },
  materials: ['Cotton', 'Polyester'],
  footer: 'CARE\n\nWash cold.',
  voice: 'Warm.',
  bannedTerms: ['disney', 'marvel'],
};

describe('settings draft', () => {
  it('round-trips stored settings', () => {
    assert.deepEqual(toSettings(draftFromSettings(settings), reference), settings);
  });

  it('starts from the reference data, preselecting single profiles only', () => {
    const draft = emptyDraft(reference);
    assert.equal(draft.taxonomyId, '482');
    assert.equal(draft.sizeScaleId, '51');
    assert.equal(draft.shippingProfileId, '1');
    assert.equal(draft.returnPolicyId, ''); // two policies: the seller picks
    assert.equal(draft.skuPattern, DEFAULT_SKU_PATTERN);
  });

  it('sends blanks and unparsable numbers as null for the server to report', () => {
    const draft = { ...draftFromSettings(settings), quantity: '', weight: 'abc', returnPolicyId: '' };
    const sent = toSettings(draft, reference);
    assert.ok(typeof sent === 'object' && sent !== null && 'quantity' in sent && 'itemSize' in sent && 'listing' in sent);
    assert.equal(sent.quantity, null);
    assert.deepEqual(sent.itemSize, { ...settings.itemSize, weight: null });
    assert.deepEqual(sent.listing, { ...settings.listing, returnPolicyId: null });
  });

  it('sends no SKU pattern when SKUs are off, and no section when none is chosen', () => {
    const draft = { ...draftFromSettings(settings), sendSkus: false, shopSectionId: '' };
    assert.deepEqual(toSettings(draft, reference), { ...settings, skuPattern: null, listing: { ...settings.listing, shopSectionId: null } });
  });

  it('splits materials on commas and banned terms on lines, dropping blanks', () => {
    const draft = { ...draftFromSettings(settings), materials: ' Cotton ,, Polyester ,', bannedTerms: 'disney\n\n  marvel \n' };
    assert.deepEqual(toSettings(draft, reference), settings);
  });

  it('sends an unchosen Etsy size as null', () => {
    const draft = draftFromSettings(settings);
    const sizes = draft.sizes.map((row, i) => (i === 0 ? { ...row, valueId: '' } : row));
    const sent = toSettings({ ...draft, sizes }, reference);
    assert.ok(typeof sent === 'object' && sent !== null && 'sizes' in sent && Array.isArray(sent.sizes));
    assert.deepEqual(sent.sizes[0], { name: 'S', etsy: null, price: 25.98 });
  });
});

describe('matching server errors to fields', () => {
  const errors = [
    { field: 'sizes', reason: 'needs at least one value' },
    { field: 'sizes[0].price', reason: 'is not a price' },
    { field: 'sizes[1].etsy.name', reason: 'is empty' },
    { field: 'materials[1]', reason: 'has a "%"' },
    { field: 'footer', reason: 'is empty' },
  ];

  it('errorsAt matches the exact field only', () => {
    assert.deepEqual(errorsAt(errors, 'sizes'), ['needs at least one value']);
    assert.deepEqual(errorsAt(errors, 'sizes[0].price'), ['is not a price']);
    assert.deepEqual(errorsAt(errors, 'footer'), ['is empty']);
    assert.deepEqual(errorsAt(errors, 'foot'), []);
  });

  it('errorsUnder includes nested fields with a short label', () => {
    assert.deepEqual(errorsUnder(errors, 'materials'), ['#2: has a "%"']);
    assert.deepEqual(errorsUnder(errors, 'sizes[1].etsy'), ['name: is empty']);
    assert.deepEqual(errorsUnder(errors, 'sizes[1]'), ['etsy.name: is empty']);
    assert.deepEqual(errorsUnder(errors, 'size'), []);
  });
});
