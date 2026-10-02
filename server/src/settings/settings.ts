// The shop's defaults (SPEC.md → shop-settings): the product template, listing defaults,
// description footer, voice notes and banned terms. Stored as one zod-validated JSON
// row in `settings`. Settings only save when they would build a valid inventory and pass
// Etsy's text rules, so a push never fails on a bad default.
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { checkDescription, checkMaterials, type RuleError } from '../guard/rules.ts';
import { buildInventory } from '../publisher/inventory.ts';

const SAMPLE_DESIGN = 'Design'; // stands in for {design} when checking the SKU pattern

const id = z.int().positive();
const EtsyValue = z.object({ valueId: id, name: z.string() });

export const Settings = z.object({
  // Resolved once from the shop's reference data, never hard-coded (SPEC.md → Boundaries).
  etsy: z.object({
    taxonomyId: id,
    sizePropertyId: id,
    sizePropertyName: z.string().min(1),
    sizeScaleId: id,
    colorPropertyId: id,
    colorPropertyName: z.string().min(1),
  }),
  sizes: z.array(z.object({ name: z.string(), etsy: EtsyValue, price: z.number() })),
  colors: z.array(z.object({ name: z.string(), etsy: EtsyValue.nullable() })), // null: sent as a custom value
  quantity: z.int(),
  skuPattern: z.string().nullable(),
  // Packed size of one shirt; calculated shipping profiles need it (SPEC.md → createDraftListing).
  itemSize: z.object({
    weight: z.number().positive(),
    weightUnit: z.enum(['oz', 'lb', 'g', 'kg']),
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
    dimensionsUnit: z.enum(['in', 'ft', 'mm', 'cm', 'm', 'yd']),
  }),
  listing: z.object({
    shippingProfileId: id,
    returnPolicyId: id,
    readinessStateId: id, // the processing profile
    shopSectionId: id.nullable(),
  }),
  materials: z.array(z.string()),
  footer: z.string(), // appended word for word to every description
  voice: z.string(),
  bannedTerms: z.array(z.string()),
});
export type Settings = z.infer<typeof Settings>;

export type SettingsResult = { ok: true; settings: Settings } | { ok: false; errors: RuleError[] };

// zod path ['sizes', 0, 'price'] → "sizes[0].price"
function fieldName(path: readonly PropertyKey[]): string {
  return path.map((key, i) => (typeof key === 'number' ? `[${key}]` : `${i === 0 ? '' : '.'}${String(key)}`)).join('');
}

export function validateSettings(input: unknown): SettingsResult {
  const parsed = Settings.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => ({ field: fieldName(issue.path), reason: issue.message })) };
  }
  const settings = parsed.data;
  const inventory = buildInventory({
    ...settings.etsy,
    design: SAMPLE_DESIGN,
    sizes: settings.sizes,
    colors: settings.colors,
    quantity: settings.quantity,
    skuPattern: settings.skuPattern,
    readinessStateId: settings.listing.readinessStateId,
  });
  const errors: RuleError[] = [
    ...(inventory.ok ? [] : inventory.problems),
    ...checkMaterials(settings.materials),
    ...checkDescription(settings.footer, 'footer'),
  ];
  settings.bannedTerms.forEach((term, i) => {
    if (term.trim() === '') errors.push({ field: `bannedTerms[${i}]`, reason: 'is empty' });
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, settings };
}

export type StoredSettings = { settings: Settings; updatedAt: number };

export function loadSettings(db: DatabaseSync): StoredSettings | undefined {
  const row = db.prepare('SELECT settings_json, updated_at FROM settings WHERE id = 1').get();
  if (!row) return undefined;
  const json = row['settings_json'];
  const updatedAt = row['updated_at'];
  if (typeof json !== 'string' || typeof updatedAt !== 'number') throw new Error('The settings row has unexpected column types');
  // Parsed again on read, so a row from an older schema fails loudly instead of being half-used.
  return { settings: Settings.parse(JSON.parse(json)), updatedAt };
}

export function saveSettings(db: DatabaseSync, settings: Settings, now: number): StoredSettings {
  db.prepare(
    `INSERT INTO settings (id, settings_json, updated_at) VALUES (1, ?, ?)
     ON CONFLICT (id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at`,
  ).run(JSON.stringify(settings), now);
  return { settings, updatedAt: now };
}
