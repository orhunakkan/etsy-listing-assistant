import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildInventory, skuPart, type InventoryInput, type InventoryPayload } from './inventory.ts';

// Ids are made up; real ones come from the shop reference data at runtime.
const SIZE = 9001;
const COLOR = 200;
const SCALE = 51;
const READINESS = 777;

const base: InventoryInput = {
  design: 'Sunset Tee',
  sizes: [
    { name: 'S', etsy: { valueId: 11, name: 'S' }, price: 22 },
    { name: '2XL', etsy: { valueId: 15, name: '2X' }, price: 25.5 },
  ],
  colors: [
    { name: 'Black', etsy: { valueId: 1, name: 'Black' } },
    { name: 'Heather Grey', etsy: null },
  ],
  quantity: 10,
  skuPattern: '{design}-{size}-{color}',
  readinessStateId: READINESS,
  sizePropertyId: SIZE,
  sizeScaleId: SCALE,
  colorPropertyId: COLOR,
};

function payload(input: InventoryInput): InventoryPayload {
  const result = buildInventory(input);
  if (!result.ok) assert.fail(`unexpected problems: ${JSON.stringify(result.problems)}`);
  return result.payload;
}

function problems(input: InventoryInput): string[] {
  const result = buildInventory(input);
  if (result.ok) assert.fail('expected problems');
  return result.problems.map((p) => `${p.field}: ${p.reason}`);
}

describe('buildInventory', () => {
  it('makes one product per size × color, size-major, priced by size', () => {
    const { products } = payload(base);
    assert.deepEqual(
      products.map((p) => [p.sku, p.offerings[0]?.price]),
      [
        ['SUNSET-TEE-S-BLACK', 22],
        ['SUNSET-TEE-S-HEATHER-GREY', 22],
        ['SUNSET-TEE-2XL-BLACK', 25.5],
        ['SUNSET-TEE-2XL-HEATHER-GREY', 25.5],
      ],
    );
  });

  it('sends the size with its scale and Etsy value, and a mapped color by value id', () => {
    const first = payload(base).products[0];
    assert.deepEqual(first, {
      sku: 'SUNSET-TEE-S-BLACK',
      property_values: [
        { property_id: SIZE, value_ids: [11], values: ['S'], scale_id: SCALE },
        { property_id: COLOR, value_ids: [1], values: ['Black'] },
      ],
      offerings: [{ price: 22, quantity: 10, is_enabled: true, readiness_state_id: READINESS }],
    });
  });

  it("uses Etsy's value name for a mapped size, and the shop's name in the SKU", () => {
    const product = payload(base).products[2];
    assert.deepEqual(product?.property_values[0]?.values, ['2X']);
    assert.equal(product?.sku, 'SUNSET-TEE-2XL-BLACK');
  });

  it('sends an unmapped color as a custom value: no value ids, the name as the value', () => {
    const custom = payload(base).products[1]?.property_values[1];
    assert.deepEqual(custom, { property_id: COLOR, value_ids: [], values: ['Heather Grey'] });
  });

  it('sets the *_on_property arrays', () => {
    const { products: _products, ...onProperty } = payload(base);
    assert.deepEqual(onProperty, {
      price_on_property: [SIZE],
      quantity_on_property: [SIZE, COLOR],
      sku_on_property: [SIZE, COLOR],
      readiness_state_on_property: [],
    });
  });

  const skuCases: Array<{ pattern: string | null; skus: Array<string | undefined>; on: number[] }> = [
    { pattern: '{design}-{size}-{color}', skus: ['SUNSET-TEE-S-BLACK', 'SUNSET-TEE-S-HEATHER-GREY'], on: [SIZE, COLOR] },
    { pattern: 'PP-{size}', skus: ['PP-S', 'PP-S'], on: [SIZE] },
    { pattern: '{color}/{design}', skus: ['BLACK/SUNSET-TEE', 'HEATHER-GREY/SUNSET-TEE'], on: [COLOR] },
    { pattern: 'FIXED', skus: ['FIXED', 'FIXED'], on: [] },
    { pattern: null, skus: [undefined, undefined], on: [] },
  ];
  for (const { pattern, skus, on } of skuCases) {
    it(`SKU pattern ${JSON.stringify(pattern)} → ${JSON.stringify(skus)}, sku_on_property ${JSON.stringify(on)}`, () => {
      const result = payload({ ...base, skuPattern: pattern });
      assert.deepEqual(result.products.slice(0, 2).map((p) => p.sku), skus);
      assert.equal(result.products.every((p) => 'sku' in p), pattern !== null);
      assert.deepEqual(result.sku_on_property, on);
    });
  }

  const rejected: Array<{ name: string; input: InventoryInput; expected: string[] }> = [
    {
      name: 'a color with parentheses',
      input: { ...base, colors: [{ name: 'Navy (Dark)', etsy: null }] },
      expected: ['colors[0].name: "Navy (Dark)" contains parentheses, which Etsy rejects'],
    },
    {
      name: 'an Etsy value name with parentheses',
      input: { ...base, sizes: [{ name: 'S', etsy: { valueId: 11, name: 'S (Youth)' }, price: 20 }] },
      expected: ['sizes[0].etsy.name: "S (Youth)" contains parentheses, which Etsy rejects'],
    },
    {
      name: 'a blank color name',
      input: { ...base, colors: [{ name: '  ', etsy: null }] },
      expected: ['colors[0].name: "  " is empty'],
    },
    {
      name: 'duplicate colors that differ only in case and spacing',
      input: { ...base, colors: [{ name: 'Heather Grey', etsy: null }, { name: 'heather  grey', etsy: null }] },
      expected: ['colors[1].name: "heather  grey" duplicates an earlier value'],
    },
    {
      name: 'no sizes and no colors',
      input: { ...base, sizes: [], colors: [] },
      expected: ['sizes: needs at least one value', 'colors: needs at least one value'],
    },
    {
      name: 'zero, negative, fractional-cent and NaN prices',
      input: {
        ...base,
        sizes: [0, -5, 19.999, Number.NaN].map((price, i) => ({ name: `S${i}`, etsy: { valueId: i + 1, name: `S${i}` }, price })),
      },
      expected: [
        'sizes[0].price: 0 is not a positive price in cents',
        'sizes[1].price: -5 is not a positive price in cents',
        'sizes[2].price: 19.999 is not a positive price in cents',
        'sizes[3].price: NaN is not a positive price in cents',
      ],
    },
    {
      name: 'a zero quantity',
      input: { ...base, quantity: 0 },
      expected: ['quantity: 0 is not a whole number of at least 1'],
    },
    {
      name: 'a fractional quantity',
      input: { ...base, quantity: 2.5 },
      expected: ['quantity: 2.5 is not a whole number of at least 1'],
    },
    {
      name: 'an unknown SKU token',
      input: { ...base, skuPattern: '{design}-{colour}' },
      expected: ['skuPattern: {colour} is not one of {design}, {size}, {color}'],
    },
    {
      name: 'an empty SKU pattern',
      input: { ...base, skuPattern: ' ' },
      expected: ['skuPattern: is empty; use no pattern to send no SKUs'],
    },
    {
      name: 'a design with nothing to put in the SKU',
      input: { ...base, design: '★★★' },
      expected: ['design: has no letters or digits to put in the SKU'],
    },
  ];
  for (const { name, input, expected } of rejected) {
    it(`rejects ${name}`, () => {
      assert.deepEqual(problems(input), expected);
    });
  }

  it('accepts prices with float noise in cents (19.99, 0.1 + 0.2)', () => {
    const sizes = [19.99, 0.1 + 0.2].map((price, i) => ({ name: `S${i}`, etsy: { valueId: i + 1, name: `S${i}` }, price }));
    assert.equal(buildInventory({ ...base, sizes }).ok, true);
  });
});

describe('skuPart', () => {
  const cases: Array<[string, string]> = [
    ['Heather Grey', 'HEATHER-GREY'],
    ['  2XL ', '2XL'],
    ["Mom's Tee!", 'MOM-S-TEE'],
    ['Café', 'CAFE'],
    ['---', ''],
  ];
  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} → ${JSON.stringify(expected)}`, () => assert.equal(skuPart(input), expected));
  }
});
