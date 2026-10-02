// The Settings form's working copy. Inputs hold strings, so a half-typed number stays as
// typed. toSettings converts on save and leaves validation to the server; errorsAt and
// errorsUnder match its field errors (e.g. "sizes[0].price") back to inputs.
import type { DimensionsUnit, FieldError, Settings, ShopReference, WeightUnit } from './api.ts';

export const DEFAULT_SKU_PATTERN = '{design}-{size}-{color}';

export type SizeRow = { key: number; name: string; valueId: string; price: string };
export type ColorRow = { key: number; name: string; valueId: string }; // valueId '' = custom value (no Etsy match)

export type Draft = {
  taxonomyId: string;
  sizeScaleId: string;
  sizes: SizeRow[];
  colors: ColorRow[];
  quantity: string;
  sendSkus: boolean;
  skuPattern: string;
  weight: string;
  weightUnit: WeightUnit;
  length: string;
  width: string;
  height: string;
  dimensionsUnit: DimensionsUnit;
  shippingProfileId: string;
  returnPolicyId: string;
  readinessStateId: string;
  shopSectionId: string; // '' = no section
  materials: string; // comma-separated: Etsy materials can't contain commas
  footer: string;
  voice: string;
  bannedTerms: string; // one per line
};

let lastKey = 0;
export function rowKey(): number {
  lastKey += 1;
  return lastKey;
}

const text = (n: number | null | undefined): string => (n === null || n === undefined ? '' : String(n));

// Preselects a profile only when the shop has exactly one.
function onlyId(list: ReadonlyArray<{ id: number }>): string {
  return list.length === 1 ? text(list[0]?.id) : '';
}

export function emptyDraft(reference: ShopReference): Draft {
  return {
    taxonomyId: text(reference.tshirt?.id),
    sizeScaleId: text(reference.sizeScaleId),
    sizes: [],
    colors: [],
    quantity: '',
    sendSkus: true,
    skuPattern: DEFAULT_SKU_PATTERN,
    weight: '',
    weightUnit: 'oz',
    length: '',
    width: '',
    height: '',
    dimensionsUnit: 'in',
    shippingProfileId: onlyId(reference.shippingProfiles),
    returnPolicyId: onlyId(reference.returnPolicies),
    readinessStateId: onlyId(reference.processingProfiles),
    shopSectionId: '',
    materials: '',
    footer: '',
    voice: '',
    bannedTerms: '',
  };
}

export function draftFromSettings(settings: Settings): Draft {
  return {
    taxonomyId: text(settings.etsy.taxonomyId),
    sizeScaleId: text(settings.etsy.sizeScaleId),
    sizes: settings.sizes.map((s) => ({ key: rowKey(), name: s.name, valueId: text(s.etsy.valueId), price: text(s.price) })),
    colors: settings.colors.map((c) => ({ key: rowKey(), name: c.name, valueId: text(c.etsy?.valueId) })),
    quantity: text(settings.quantity),
    sendSkus: settings.skuPattern !== null,
    skuPattern: settings.skuPattern ?? DEFAULT_SKU_PATTERN,
    weight: text(settings.itemSize.weight),
    weightUnit: settings.itemSize.weightUnit,
    length: text(settings.itemSize.length),
    width: text(settings.itemSize.width),
    height: text(settings.itemSize.height),
    dimensionsUnit: settings.itemSize.dimensionsUnit,
    shippingProfileId: text(settings.listing.shippingProfileId),
    returnPolicyId: text(settings.listing.returnPolicyId),
    readinessStateId: text(settings.listing.readinessStateId),
    shopSectionId: text(settings.listing.shopSectionId),
    materials: settings.materials.join(', '),
    footer: settings.footer,
    voice: settings.voice,
    bannedTerms: settings.bannedTerms.join('\n'),
  };
}

// '' and non-numbers become null, so the server reports them against their field.
function num(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function splitList(value: string, separator: string): string[] {
  return value
    .split(separator)
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

// What PUT /api/settings receives. Not typed as Settings: missing numbers go as null and
// an unchosen Etsy size as null, and the server names each problem.
export function toSettings(draft: Draft, reference: ShopReference): unknown {
  const etsyValue = (values: ReadonlyArray<{ valueId: number; name: string }> | undefined, valueId: string) => {
    const value = values?.find((v) => String(v.valueId) === valueId);
    return value ? { valueId: value.valueId, name: value.name } : null;
  };
  return {
    etsy: {
      taxonomyId: num(draft.taxonomyId),
      sizePropertyId: reference.size?.propertyId ?? null,
      sizePropertyName: reference.size?.name ?? '',
      sizeScaleId: num(draft.sizeScaleId),
      colorPropertyId: reference.color?.propertyId ?? null,
      colorPropertyName: reference.color?.name ?? '',
    },
    sizes: draft.sizes.map((row) => ({ name: row.name.trim(), etsy: etsyValue(reference.size?.values, row.valueId), price: num(row.price) })),
    colors: draft.colors.map((row) => ({ name: row.name.trim(), etsy: etsyValue(reference.color?.values, row.valueId) })),
    quantity: num(draft.quantity),
    skuPattern: draft.sendSkus ? draft.skuPattern.trim() : null,
    itemSize: {
      weight: num(draft.weight),
      weightUnit: draft.weightUnit,
      length: num(draft.length),
      width: num(draft.width),
      height: num(draft.height),
      dimensionsUnit: draft.dimensionsUnit,
    },
    listing: {
      shippingProfileId: num(draft.shippingProfileId),
      returnPolicyId: num(draft.returnPolicyId),
      readinessStateId: num(draft.readinessStateId),
      shopSectionId: num(draft.shopSectionId),
    },
    materials: splitList(draft.materials, ','),
    footer: draft.footer.trim(),
    voice: draft.voice.trim(),
    bannedTerms: splitList(draft.bannedTerms, '\n'),
  };
}

// Errors for exactly this field, e.g. "quantity" or "sizes" (the list itself).
export function errorsAt(errors: readonly FieldError[], field: string): string[] {
  return errors.filter((e) => e.field === field).map((e) => e.reason);
}

// Errors for this field and everything inside it. "materials[1]" → "#2: …",
// "sizes[0].etsy.name" under "sizes[0].etsy" → "name: …".
export function errorsUnder(errors: readonly FieldError[], field: string): string[] {
  return errors.flatMap((e) => {
    if (e.field === field) return [e.reason];
    const rest = e.field.startsWith(field) ? e.field.slice(field.length) : '';
    const index = /^\[(\d+)\]$/.exec(rest);
    if (index) return [`#${Number(index[1]) + 1}: ${e.reason}`];
    if (rest.startsWith('.') || rest.startsWith('[')) return [`${rest.replace(/^\./, '')}: ${e.reason}`];
    return [];
  });
}
