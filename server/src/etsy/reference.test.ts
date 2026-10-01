import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EtsyFetch } from './client.ts';
import {
  fetchShopReference,
  findTshirtNodes,
  parseProcessingProfiles,
  parseReturnPolicies,
  parseSections,
  parseShippingProfiles,
  parseVariationProperties,
  pickColorProperty,
  pickSizeProperty,
  pickSizeScale,
  pickTshirtNode,
  type TaxonomyMatch,
} from './reference.ts';

// Response shapes follow the OpenAPI schemas (SellerTaxonomyNodes, TaxonomyNodeProperties, ...).
// The ids are made up; real ones come from Etsy at runtime.
const node = (id: number, name: string, children: unknown[] = []) => ({
  id,
  level: 0,
  name,
  parent_id: null,
  children,
  full_path_taxonomy_ids: [id],
});

const taxonomy = {
  count: 2,
  results: [
    node(1, 'Clothing', [
      node(10, 'Gender-Neutral Adult Clothing', [node(11, 'Tops & Tees', [node(12, 'T-shirts')])]),
      node(20, "Men's Clothing", [node(21, 'Shirts & Tees', [node(22, 'T-shirts')])]),
      node(30, "Women's Clothing", [node(31, 'Tops & Tees', [node(32, 'T-shirts')])]),
      node(40, "Kids' Clothing", [node(41, 'Tops & Tees', [node(42, 'T-shirts')])]),
      node(50, 'Baby Clothing', [node(51, 'T-Shirts')]),
    ]),
    node(2, 'Pet Supplies', [node(60, 'Pet Clothing', [node(61, 'Shirts')])]),
  ],
};

const properties = {
  count: 3,
  results: [
    {
      property_id: 100,
      name: 'size',
      display_name: 'Size',
      scales: [
        { scale_id: 301, display_name: 'Letter', description: 'XS-XXL' },
        { scale_id: 302, display_name: 'Numeric', description: '0-20' },
      ],
      is_required: false,
      supports_attributes: false,
      supports_variations: true,
      is_multivalued: false,
      max_values_allowed: null,
      possible_values: [
        { value_id: 1, name: 'S', scale_id: 301, equal_to: [] },
        { value_id: 2, name: 'M', scale_id: 301, equal_to: [] },
        { value_id: 3, name: 'L', scale_id: 301, equal_to: [] },
        { value_id: 4, name: 'XL', scale_id: 301, equal_to: [] },
        { value_id: 5, name: '8', scale_id: 302, equal_to: [] },
      ],
      selected_values: [],
    },
    {
      property_id: 200,
      name: 'primary_color',
      display_name: 'Primary color',
      scales: [],
      supports_variations: true,
      possible_values: [
        { value_id: 1, name: 'Black', scale_id: null, equal_to: [] },
        { value_id: 2, name: 'White', scale_id: null, equal_to: [] },
      ],
    },
    { property_id: 300, name: 'secondary_color', display_name: 'Secondary color', scales: [], supports_variations: true, possible_values: [] },
  ],
};

describe('findTshirtNodes and pickTshirtNode', () => {
  it('finds every T-shirt node with its path, in any letter case', () => {
    assert.deepEqual(
      findTshirtNodes(taxonomy).map((c) => c.id),
      [12, 22, 32, 42, 51],
    );
    assert.deepEqual(findTshirtNodes(taxonomy)[0]?.path, ['Clothing', 'Gender-Neutral Adult Clothing', 'Tops & Tees', 'T-shirts']);
  });

  it('picks the gender-neutral adult node over the gendered and kids ones', () => {
    assert.equal(pickTshirtNode(findTshirtNodes(taxonomy))?.id, 12);
  });

  const match = (id: number, ...path: string[]): TaxonomyMatch => ({ id, path });

  it('takes the only adult node when none is marked unisex', () => {
    assert.equal(pickTshirtNode([match(1, 'Clothing', 'Tops', 'T-shirts'), match(2, 'Clothing', "Kids' Clothing", 'T-shirts')])?.id, 1);
  });

  it('returns nothing rather than guessing between several candidates', () => {
    assert.equal(pickTshirtNode([match(1, "Men's Clothing", 'T-shirts'), match(2, "Women's Clothing", 'T-shirts')]), undefined);
    assert.equal(pickTshirtNode([match(1, 'Unisex Adult', 'T-shirts'), match(2, 'Gender-Neutral Adult Clothing', 'T-shirts')]), undefined);
    assert.equal(pickTshirtNode([]), undefined);
  });

  it('rejects a response that is not a taxonomy tree', () => {
    assert.throws(() => findTshirtNodes({ count: 1, results: [{ id: 'x' }] }));
  });
});

describe('variation properties', () => {
  const parsed = parseVariationProperties(properties);

  it('reads property ids, scales and value ids', () => {
    assert.deepEqual(parsed[0], {
      propertyId: 100,
      name: 'Size',
      scales: [
        { scaleId: 301, name: 'Letter' },
        { scaleId: 302, name: 'Numeric' },
      ],
      values: [
        { valueId: 1, name: 'S', scaleId: 301 },
        { valueId: 2, name: 'M', scaleId: 301 },
        { valueId: 3, name: 'L', scaleId: 301 },
        { valueId: 4, name: 'XL', scaleId: 301 },
        { valueId: 5, name: '8', scaleId: 302 },
      ],
    });
  });

  it('picks the size property and its letter scale', () => {
    const size = pickSizeProperty(parsed);
    assert.equal(size?.propertyId, 100);
    assert.ok(size);
    assert.equal(pickSizeScale(size), 301);
  });

  it('picks the primary color over the secondary color', () => {
    assert.equal(pickColorProperty(parsed)?.propertyId, 200);
    assert.equal(pickColorProperty(parsed.toReversed())?.propertyId, 200);
  });

  it('falls back to any color property', () => {
    assert.equal(pickColorProperty([{ propertyId: 9, name: 'Colour', scales: [], values: [] }])?.propertyId, 9);
  });

  it('finds no size scale when no scale has letter sizes', () => {
    assert.equal(pickSizeScale({ propertyId: 1, name: 'Size', scales: [{ scaleId: 1, name: 'Numeric' }], values: [{ valueId: 1, name: '8', scaleId: 1 }] }), undefined);
  });

  it('skips properties that do not support variations', () => {
    assert.deepEqual(parseVariationProperties({ count: 1, results: [{ property_id: 5, name: 'occasion', supports_variations: false }] }), []);
  });
});

describe('shop profiles', () => {
  it('reads shipping profiles and drops deleted ones', () => {
    const body = {
      count: 2,
      results: [
        { shipping_profile_id: 7, title: 'Standard', user_id: 42, origin_country_iso: 'US', is_deleted: false, shipping_profile_destinations: [] },
        { shipping_profile_id: 8, title: 'Old', user_id: 42, origin_country_iso: 'US', is_deleted: true },
      ],
    };
    assert.deepEqual(parseShippingProfiles(body), [{ id: 7, title: 'Standard', originCountry: 'US' }]);
  });

  it('reads return policies', () => {
    const body = { count: 1, results: [{ return_policy_id: 4, shop_id: 777, accepts_returns: true, accepts_exchanges: false, return_deadline: 30 }] };
    assert.deepEqual(parseReturnPolicies(body), [{ id: 4, acceptsReturns: true, acceptsExchanges: false, returnDeadlineDays: 30 }]);
  });

  it('reads processing profiles, labelling them from the days when Etsy gives no label', () => {
    const body = {
      count: 2,
      results: [
        { shop_id: 777, readiness_state_id: 55, readiness_state: 'made_to_order', min_processing_days: 3, max_processing_days: 5, processing_days_display_label: '3-5 days' },
        { shop_id: 777, readiness_state_id: 56, readiness_state: 'ready_to_ship', min_processing_days: 1, max_processing_days: 2 },
      ],
    };
    assert.deepEqual(parseProcessingProfiles(body), {
      count: 2,
      profiles: [
        { id: 55, readinessState: 'made_to_order', label: '3-5 days' },
        { id: 56, readinessState: 'ready_to_ship', label: '1-2 days' },
      ],
    });
  });

  it('orders sections by rank', () => {
    const body = {
      count: 2,
      results: [
        { shop_section_id: 2, title: 'Funny', rank: 2, user_id: 42, active_listing_count: 0 },
        { shop_section_id: 1, title: 'Vintage', rank: 1, user_id: 42, active_listing_count: 3 },
      ],
    };
    assert.deepEqual(parseSections(body), [
      { id: 1, title: 'Vintage' },
      { id: 2, title: 'Funny' },
    ]);
  });
});

describe('fetchShopReference', () => {
  function fakeEtsy(processingPages: unknown[][]): EtsyFetch & { paths: string[] } {
    const paths: string[] = [];
    const reply = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    const fn = async (path: string): Promise<Response> => {
      paths.push(path);
      const { pathname, searchParams } = new URL(path, 'https://api.etsy.com');
      if (pathname.endsWith('/shipping-profiles')) return reply({ count: 1, results: [{ shipping_profile_id: 7, title: 'Standard', origin_country_iso: 'US' }] });
      if (pathname.endsWith('/policies/return')) return reply({ count: 1, results: [{ return_policy_id: 4, accepts_returns: true, accepts_exchanges: true, return_deadline: 30 }] });
      if (pathname.endsWith('/readiness-state-definitions')) {
        const page = Number(searchParams.get('offset')) / 100;
        const total = processingPages.reduce((n, p) => n + p.length, 0);
        return reply({ count: total, results: processingPages[page] ?? [] });
      }
      if (pathname.endsWith('/sections')) return reply({ count: 0, results: [] });
      if (pathname === '/v3/application/seller-taxonomy/nodes') return reply(taxonomy);
      if (pathname === '/v3/application/seller-taxonomy/nodes/12/properties') return reply(properties);
      throw new Error(`unexpected path ${path}`);
    };
    return Object.assign(fn, { paths });
  }

  const profile = (id: number) => ({ readiness_state_id: id, readiness_state: 'made_to_order', processing_days_display_label: '3-5 days' });

  it('gathers everything and resolves the T-shirt variation ids', async () => {
    const etsy = fakeEtsy([[profile(55)]]);
    const ref = await fetchShopReference(etsy, 777);
    assert.equal(ref.tshirt?.id, 12);
    assert.equal(ref.size?.propertyId, 100);
    assert.equal(ref.sizeScaleId, 301);
    assert.equal(ref.color?.propertyId, 200);
    assert.deepEqual(ref.shippingProfiles, [{ id: 7, title: 'Standard', originCountry: 'US' }]);
    assert.deepEqual(ref.processingProfiles, [{ id: 55, readinessState: 'made_to_order', label: '3-5 days' }]);
    assert.ok(etsy.paths.includes('/v3/application/seller-taxonomy/nodes/12/properties?supports_variations=true'));
  });

  it('pages through processing profiles', async () => {
    const first = Array.from({ length: 100 }, (_, i) => profile(1000 + i));
    const etsy = fakeEtsy([first, [profile(2000)]]);
    const ref = await fetchShopReference(etsy, 777);
    assert.equal(ref.processingProfiles.length, 101);
    assert.equal(etsy.paths.filter((p) => p.includes('readiness-state-definitions')).length, 2);
  });
});
