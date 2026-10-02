// Builds the updateListingInventory payload: one product per size × color, priced by
// size. Pure: every id comes from the caller (shop reference data and settings), never
// hard-coded (SPEC.md → Boundaries). The shape follows the OpenAPI request body of
// updateListingInventory (PUT /v3/application/listings/{listing_id}/inventory).
//
// A color with no Etsy match is sent as a custom value: `value_ids: []` and the name in
// `values` (https://github.com/etsy/open-api/discussions/1253). Checkpoint C confirms it.
import { checkVariationValue } from '../guard/rules.ts';

const SKU_TOKEN = /\{(\w+)\}/g;
const SKU_TOKENS = new Set(['design', 'size', 'color']);

export type EtsyValue = { valueId: number; name: string }; // a value of the taxonomy property
// `name` is the shop's own name (used in SKUs); `etsy.name` is what Etsy shows buyers.
export type SizeOption = { name: string; etsy: EtsyValue; price: number };
export type ColorOption = { name: string; etsy: EtsyValue | null };

export type InventoryInput = {
  design: string; // fills {design} in the SKU pattern
  sizes: readonly SizeOption[];
  colors: readonly ColorOption[];
  quantity: number; // per variation
  skuPattern: string | null; // e.g. "{design}-{size}-{color}"; null sends no SKUs
  readinessStateId: number; // the processing profile
  sizePropertyId: number;
  sizePropertyName: string; // Etsy requires property_name (HTTP 400 seen live in T9)
  sizeScaleId: number;
  colorPropertyId: number;
  colorPropertyName: string;
};

export type PropertyValue = { property_id: number; property_name: string; value_ids: number[]; values: string[]; scale_id?: number };
export type Offering = { price: number; quantity: number; is_enabled: boolean; readiness_state_id: number };
export type Product = { sku?: string; property_values: PropertyValue[]; offerings: Offering[] };
export type InventoryPayload = {
  products: Product[];
  price_on_property: number[];
  quantity_on_property: number[];
  sku_on_property: number[];
  readiness_state_on_property: number[];
};

export type InventoryProblem = { field: string; reason: string };
export type InventoryResult = { ok: true; payload: InventoryPayload } | { ok: false; problems: InventoryProblem[] };

// The form a name takes inside a SKU: "Heather Grey" → "HEATHER-GREY", "Café" → "CAFE".
export function skuPart(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function checkOptions(field: string, options: ReadonlyArray<{ name: string; etsy: EtsyValue | null }>): InventoryProblem[] {
  const problems: InventoryProblem[] = [];
  if (options.length === 0) problems.push({ field, reason: 'needs at least one value' });
  const seen = new Set<string>();
  options.forEach((option, i) => {
    const at = `${field}[${i}]`;
    for (const [where, value] of [['name', option.name], ['etsy.name', option.etsy?.name]] as const) {
      if (value !== undefined) problems.push(...checkVariationValue(value, `${at}.${where}`));
    }
    const key = skuPart(option.name);
    if (key !== '' && seen.has(key)) problems.push({ field: `${at}.name`, reason: `"${option.name}" duplicates an earlier value` });
    seen.add(key);
  });
  return problems;
}

function isPrice(price: number): boolean {
  return Number.isFinite(price) && price > 0 && Math.abs(price * 100 - Math.round(price * 100)) < 1e-6;
}

function checkInput(input: InventoryInput): InventoryProblem[] {
  const problems = [...checkOptions('sizes', input.sizes), ...checkOptions('colors', input.colors)];
  input.sizes.forEach((size, i) => {
    if (!isPrice(size.price)) problems.push({ field: `sizes[${i}].price`, reason: `${size.price} is not a positive price in cents` });
  });
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    problems.push({ field: 'quantity', reason: `${input.quantity} is not a whole number of at least 1` });
  }
  if (input.skuPattern !== null) {
    if (input.skuPattern.trim() === '') problems.push({ field: 'skuPattern', reason: 'is empty; use no pattern to send no SKUs' });
    const tokens = [...input.skuPattern.matchAll(SKU_TOKEN)].map((m) => m[1] ?? '');
    for (const token of tokens.filter((t) => !SKU_TOKENS.has(t))) {
      problems.push({ field: 'skuPattern', reason: `{${token}} is not one of {design}, {size}, {color}` });
    }
    if (input.skuPattern.includes('{design}') && skuPart(input.design) === '') {
      problems.push({ field: 'design', reason: 'has no letters or digits to put in the SKU' });
    }
  }
  return problems;
}

export function buildInventory(input: InventoryInput): InventoryResult {
  const problems = checkInput(input);
  if (problems.length > 0) return { ok: false, problems };

  const pattern = input.skuPattern;
  const sku = (size: SizeOption, color: ColorOption): string | undefined =>
    pattern === null
      ? undefined
      : pattern.replace(SKU_TOKEN, (_match, token: string) =>
          skuPart(token === 'design' ? input.design : token === 'size' ? size.name : color.name),
        );

  const products = input.sizes.flatMap((size) =>
    input.colors.map((color): Product => {
      const sizeValue: PropertyValue = {
        property_id: input.sizePropertyId,
        property_name: input.sizePropertyName,
        value_ids: [size.etsy.valueId],
        values: [size.etsy.name.trim()],
        scale_id: input.sizeScaleId,
      };
      const colorProperty = { property_id: input.colorPropertyId, property_name: input.colorPropertyName };
      const colorValue: PropertyValue = color.etsy
        ? { ...colorProperty, value_ids: [color.etsy.valueId], values: [color.etsy.name.trim()] }
        : { ...colorProperty, value_ids: [], values: [color.name.trim()] };
      const offering: Offering = { price: size.price, quantity: input.quantity, is_enabled: true, readiness_state_id: input.readinessStateId };
      const productSku = sku(size, color);
      return {
        ...(productSku === undefined ? {} : { sku: productSku }),
        property_values: [sizeValue, colorValue],
        offerings: [offering],
      };
    }),
  );

  // Etsy refuses SKUs that vary on a property missing from sku_on_property, so the
  // array lists exactly the properties the pattern uses.
  const skuOn = pattern === null ? [] : [
    ...(pattern.includes('{size}') ? [input.sizePropertyId] : []),
    ...(pattern.includes('{color}') ? [input.colorPropertyId] : []),
  ];
  // Products sharing a SKU must share a quantity (Etsy listings tutorial), so quantity
  // varies on the SKU's properties; without SKUs it is per size × color.
  const both = [input.sizePropertyId, input.colorPropertyId];
  const quantityOn = pattern === null ? both : skuOn;
  // Once any *_on_property names both properties, Etsy accepts each of the others only
  // empty or naming both too (HTTP 400 seen live in T9). sku and quantity already agree,
  // so only the price needs widening, which is safe: a price set per size is also
  // consistent per size × color.
  const priceOn = quantityOn.length === both.length ? both : [input.sizePropertyId];

  return {
    ok: true,
    payload: {
      products,
      price_on_property: priceOn,
      quantity_on_property: quantityOn,
      sku_on_property: skuOn,
      readiness_state_on_property: [],
    },
  };
}
