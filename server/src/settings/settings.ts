// The shop's defaults (SPEC.md → shop-settings): the product template, listing defaults,
// description footer, voice notes and banned terms. Stored as one zod-validated JSON
// row in `settings`. Settings only save when they would build a valid inventory and pass
// Etsy's text rules, so a push never fails on a bad default.
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { checkDescription, checkMaterials, checkVariationValue, type RuleError } from '../guard/rules.ts';
import { buildInventory } from '../publisher/inventory.ts';

const SAMPLE_DESIGN = 'Design'; // stands in for {design} when checking the SKU pattern

// A blank form field arrives as null (or missing); say so plainly instead of zod's
// "expected number, received null". Anything else keeps zod's own message.
const required: z.core.$ZodErrorMap = (issue) => (issue.input === undefined || issue.input === null ? 'is required' : undefined);
const req = { error: required };

const id = z.int(req).positive();
const text = z.string(req);
const EtsyValue = z.object({ valueId: id, name: text }, req);

export const Settings = z.object({
  // Resolved once from the shop's reference data, never hard-coded (SPEC.md → Boundaries).
  etsy: z.object({
    taxonomyId: id,
    sizePropertyId: id,
    sizePropertyName: text.min(1),
    sizeScaleId: id,
    colorPropertyId: id,
    colorPropertyName: text.min(1),
  }),
  sizes: z.array(z.object({ name: text, etsy: EtsyValue, price: z.number(req) }), req),
  colors: z.array(z.object({ name: text, etsy: EtsyValue.nullable() }), req), // null: sent as a custom value
  quantity: z.int(req),
  skuPattern: text.nullable(),
  // Packed size of one shirt; calculated shipping profiles need it (SPEC.md → createDraftListing).
  itemSize: z.object({
    weight: z.number(req).positive(),
    weightUnit: z.enum(['oz', 'lb', 'g', 'kg'], req),
    length: z.number(req).positive(),
    width: z.number(req).positive(),
    height: z.number(req).positive(),
    dimensionsUnit: z.enum(['in', 'ft', 'mm', 'cm', 'm', 'yd'], req),
  }),
  listing: z.object({
    shippingProfileId: id,
    returnPolicyId: id,
    readinessStateId: id, // the processing profile
    shopSectionId: id.nullable(),
  }),
  materials: z.array(text, req),
  footer: text, // appended word for word to every description
  voice: text,
  bannedTerms: z.array(text, req),
});
export type Settings = z.infer<typeof Settings>;

export type SettingsResult = { ok: true; settings: Settings } | { ok: false; errors: RuleError[] };

// zod path ['sizes', 0, 'price'] → "sizes[0].price"
function fieldName(path: readonly PropertyKey[]): string {
  return path.map((key, i) => (typeof key === 'number' ? `[${key}]` : `${i === 0 ? '' : '.'}${String(key)}`)).join('');
}

const NamedRow = z.object({ name: z.string(), etsy: z.object({ name: z.string() }).nullish() });

// Etsy's text rules need only the text fields, so they run on whatever parts are well
// formed, even when other fields are wrong. One save then reports every problem.
function textRuleErrors(input: unknown): RuleError[] {
  const record: Record<string, unknown> = typeof input === 'object' && input !== null ? { ...input } : {};
  const errors: RuleError[] = [];
  for (const list of ['sizes', 'colors'] as const) {
    const rows: unknown[] = Array.isArray(record[list]) ? record[list] : [];
    rows.forEach((row, i) => {
      const parsed = NamedRow.safeParse(row);
      if (!parsed.success) return;
      errors.push(...checkVariationValue(parsed.data.name, `${list}[${i}].name`));
      if (parsed.data.etsy) errors.push(...checkVariationValue(parsed.data.etsy.name, `${list}[${i}].etsy.name`));
    });
  }
  const materials = Settings.shape.materials.safeParse(record['materials']);
  if (materials.success) errors.push(...checkMaterials(materials.data));
  const footer = Settings.shape.footer.safeParse(record['footer']);
  if (footer.success) errors.push(...checkDescription(footer.data, 'footer'));
  const bannedTerms = Settings.shape.bannedTerms.safeParse(record['bannedTerms']);
  bannedTerms.data?.forEach((term, i) => {
    if (term.trim() === '') errors.push({ field: `bannedTerms[${i}]`, reason: 'is empty' });
  });
  return errors;
}

// The inventory builder repeats the value-string checks, so identical errors are merged.
function unique(errors: readonly RuleError[]): RuleError[] {
  const seen = new Set<string>();
  return errors.filter((e) => {
    const key = `${e.field}\n${e.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function validateSettings(input: unknown): SettingsResult {
  const parsed = Settings.safeParse(input);
  const textErrors = textRuleErrors(input);
  if (!parsed.success) {
    const schemaErrors = parsed.error.issues.map((issue) => ({ field: fieldName(issue.path), reason: issue.message }));
    return { ok: false, errors: [...schemaErrors, ...textErrors] };
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
  const errors = unique([...(inventory.ok ? [] : inventory.problems), ...textErrors]);
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
