// Etsy's text rules for listing fields (SPEC.md → Text rules). Pure and deterministic:
// the guard, settings validation and copywriter normalization all use these, and rule
// errors can never be overridden.
//
// The character regexes are copied from the OpenAPI field descriptions of
// createDraftListing / updateListing (fetched 2026-10-02). Each matches a character Etsy
// does NOT allow. The OpenAPI spec states no title or tag lengths; 140, 13 and 20 come
// from Etsy's seller docs (unverified, see SPEC.md).

const TITLE_DISALLOWED = /[^\p{L}\p{Nd}\p{P}\p{Sm}\p{Zs}™©®]/gu;
const TAG_DISALLOWED = /[^\p{L}\p{Nd}\p{Zs}\-'™©®]/gu;
const MATERIAL_DISALLOWED = /[^\p{L}\p{Nd}\p{Zs}]/gu;
const STYLE_DISALLOWED = /[^\p{L}\p{Nd}\p{Zs}]/gu;
const TITLE_ONCE_ONLY = ['%', ':', '&', '+'];
const VALUE_DISALLOWED = /[()]/; // "parenthesis characters are not allowed" (OpenAPI, property_values)

const TITLE_MAX = 140;
const TAG_MAX = 20;
const TAGS_MAX = 13;
const STYLE_MAX = 45;
const STYLES_MAX = 2;
const ALT_TEXT_MAX = 500; // uploadListingImage: "Max length 500 characters"

export type RuleError = { field: string; reason: string };

// Characters, not UTF-16 units, so an astral letter counts once.
function length(text: string): number {
  return [...text].length;
}

function disallowed(field: string, text: string, pattern: RegExp): RuleError[] {
  const found = [...new Set(text.match(pattern) ?? [])];
  if (found.length === 0) return [];
  return [{ field, reason: `contains characters Etsy does not allow: ${found.map((c) => JSON.stringify(c)).join(' ')}` }];
}

function tooLong(field: string, text: string, max: number): RuleError[] {
  const n = length(text);
  return n > max ? [{ field, reason: `is ${n} characters; Etsy allows at most ${max}` }] : [];
}

function empty(field: string, text: string): RuleError[] {
  return text.trim() === '' ? [{ field, reason: 'is empty' }] : [];
}

// One short text in a list (tag, material, style): empty, too long, or bad characters.
function checkEntry(field: string, text: string, pattern: RegExp, max?: number): RuleError[] {
  const blank = empty(field, text);
  if (blank.length > 0) return blank;
  return [...(max === undefined ? [] : tooLong(field, text, max)), ...disallowed(field, text, pattern)];
}

function checkList(field: string, noun: string, entries: readonly string[], pattern: RegExp, maxEach?: number, maxCount?: number): RuleError[] {
  const errors: RuleError[] = [];
  if (maxCount !== undefined && entries.length > maxCount) {
    errors.push({ field, reason: `has ${entries.length} ${noun}; Etsy allows at most ${maxCount}` });
  }
  entries.forEach((entry, i) => errors.push(...checkEntry(`${field}[${i}]`, entry, pattern, maxEach)));
  return errors;
}

export function checkTitle(title: string, field = 'title'): RuleError[] {
  const blank = empty(field, title);
  if (blank.length > 0) return blank;
  const errors = [...tooLong(field, title, TITLE_MAX), ...disallowed(field, title, TITLE_DISALLOWED)];
  for (const char of TITLE_ONCE_ONLY) {
    const count = title.split(char).length - 1;
    if (count > 1) errors.push({ field, reason: `uses "${char}" ${count} times; Etsy allows it at most once` });
  }
  return errors;
}

export function checkTags(tags: readonly string[], field = 'tags'): RuleError[] {
  return checkList(field, 'tags', tags, TAG_DISALLOWED, TAG_MAX, TAGS_MAX);
}

export function checkMaterials(materials: readonly string[], field = 'materials'): RuleError[] {
  return checkList(field, 'materials', materials, MATERIAL_DISALLOWED);
}

export function checkStyles(styles: readonly string[], field = 'styles'): RuleError[] {
  return checkList(field, 'styles', styles, STYLE_DISALLOWED, STYLE_MAX, STYLES_MAX);
}

// Alt text may be empty (Etsy's default is "").
export function checkAltText(altText: string, field = 'altText'): RuleError[] {
  return tooLong(field, altText, ALT_TEXT_MAX);
}

// Etsy requires a description but states no character rules for it.
export function checkDescription(description: string, field = 'description'): RuleError[] {
  return empty(field, description);
}

// A size or color value string sent in updateListingInventory.
export function checkVariationValue(value: string, field: string): RuleError[] {
  const blank = empty(field, value);
  if (blank.length > 0) return blank;
  return VALUE_DISALLOWED.test(value) ? [{ field, reason: 'contains parentheses, which Etsy does not allow' }] : [];
}
