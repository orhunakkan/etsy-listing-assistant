// Reads the shop's reference data from Etsy: shipping profiles, return policies,
// processing profiles, sections, the T-shirt taxonomy node and its size and color
// variation properties. No id is hard-coded (SPEC.md → Boundaries); every one comes
// from Etsy. Responses are parsed with zod, and unknown fields are dropped.
import { z } from 'zod';
import type { EtsyFetch } from './client.ts';

const PAGE_LIMIT = 100; // the maximum getShopReadinessStateDefinitions allows
const MAX_PAGES = 20;
const TSHIRT_NODE = /^t-?shirts?$/i;
const UNISEX_PATH = /gender[- ]neutral|unisex/i; // the shop sells unisex shirts (SPEC.md → Assumptions 2)
const NOT_ADULT_PATH = /\b(kids?|baby|babies|girls?|boys?|children|toddlers?|pets?)\b/i;
const SIZE_PROPERTY = /^size$/i;
const COLOR_PROPERTY = /^primary colou?r$/i;
const ANY_COLOR_PROPERTY = /colou?r/i;
const LETTER_SIZES = new Set(['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', '2xl', 'xxxl', '3xl', '4xl', '5xl', '6xl']);

const resultList = <T extends z.ZodType>(item: T) => z.object({ count: z.int(), results: z.array(item) });

const ShippingProfiles = resultList(
  z.object({
    shipping_profile_id: z.int(),
    title: z.string().nullish(),
    origin_country_iso: z.string().nullish(),
    is_deleted: z.boolean().nullish(),
  }),
);

const ReturnPolicies = resultList(
  z.object({
    return_policy_id: z.int(),
    accepts_returns: z.boolean(),
    accepts_exchanges: z.boolean(),
    return_deadline: z.int().nullish(),
  }),
);

const ProcessingProfiles = resultList(
  z.object({
    readiness_state_id: z.int(),
    readiness_state: z.string(),
    min_processing_days: z.int().nullish(),
    max_processing_days: z.int().nullish(),
    processing_days_display_label: z.string().nullish(),
  }),
);

const Sections = resultList(z.object({ shop_section_id: z.int(), title: z.string(), rank: z.int() }));

type RawTaxonomyNode = { id: number; name: string; children: RawTaxonomyNode[] };
const TaxonomyNode: z.ZodType<RawTaxonomyNode> = z.object({
  id: z.int(),
  name: z.string(),
  get children() {
    return z.array(TaxonomyNode);
  },
});
const TaxonomyNodes = resultList(TaxonomyNode);

const TaxonomyProperties = resultList(
  z.object({
    property_id: z.int(),
    name: z.string(),
    display_name: z.string().nullish(),
    supports_variations: z.boolean().nullish(),
    scales: z.array(z.object({ scale_id: z.int(), display_name: z.string() })).nullish(),
    possible_values: z.array(z.object({ value_id: z.int(), name: z.string(), scale_id: z.int().nullish() })).nullish(),
  }),
);

export type ShippingProfile = { id: number; title: string; originCountry: string | null };
export type ReturnPolicy = { id: number; acceptsReturns: boolean; acceptsExchanges: boolean; returnDeadlineDays: number | null };
export type ProcessingProfile = { id: number; readinessState: string; label: string };
export type ShopSection = { id: number; title: string };
export type TaxonomyMatch = { id: number; path: string[] }; // path: node names from the root down to this node
export type PropertyValue = { valueId: number; name: string; scaleId: number | null };
export type VariationProperty = {
  propertyId: number;
  name: string;
  scales: Array<{ scaleId: number; name: string }>;
  values: PropertyValue[];
};

export function parseShippingProfiles(body: unknown): ShippingProfile[] {
  return ShippingProfiles.parse(body)
    .results.filter((p) => p.is_deleted !== true)
    .map((p) => ({ id: p.shipping_profile_id, title: p.title ?? '', originCountry: p.origin_country_iso ?? null }));
}

export function parseReturnPolicies(body: unknown): ReturnPolicy[] {
  return ReturnPolicies.parse(body).results.map((p) => ({
    id: p.return_policy_id,
    acceptsReturns: p.accepts_returns,
    acceptsExchanges: p.accepts_exchanges,
    returnDeadlineDays: p.return_deadline ?? null,
  }));
}

export function parseProcessingProfiles(body: unknown): { count: number; profiles: ProcessingProfile[] } {
  const { count, results } = ProcessingProfiles.parse(body);
  const profiles = results.map((p) => {
    const days = p.min_processing_days != null && p.max_processing_days != null ? `${p.min_processing_days}-${p.max_processing_days} days` : '';
    return { id: p.readiness_state_id, readinessState: p.readiness_state, label: p.processing_days_display_label ?? days };
  });
  return { count, profiles };
}

export function parseSections(body: unknown): ShopSection[] {
  return Sections.parse(body)
    .results.toSorted((a, b) => a.rank - b.rank)
    .map((s) => ({ id: s.shop_section_id, title: s.title }));
}

// Every node named "T-shirt(s)" in the seller taxonomy, with its path.
export function findTshirtNodes(body: unknown): TaxonomyMatch[] {
  const found: TaxonomyMatch[] = [];
  const walk = (node: RawTaxonomyNode, parents: string[]): void => {
    const path = [...parents, node.name];
    if (TSHIRT_NODE.test(node.name.trim())) found.push({ id: node.id, path });
    for (const child of node.children) walk(child, path);
  };
  for (const root of TaxonomyNodes.parse(body).results) walk(root, []);
  return found;
}

// The unisex adult T-shirt node. Returns undefined rather than guessing when the
// candidates are ambiguous; the seller then picks one at Checkpoint B.
export function pickTshirtNode(candidates: readonly TaxonomyMatch[]): TaxonomyMatch | undefined {
  const adult = candidates.filter((c) => !NOT_ADULT_PATH.test(c.path.join(' > ')));
  const unisex = adult.filter((c) => UNISEX_PATH.test(c.path.join(' > ')));
  if (unisex.length === 1) return unisex[0];
  return unisex.length === 0 && adult.length === 1 ? adult[0] : undefined;
}

export function parseVariationProperties(body: unknown): VariationProperty[] {
  return TaxonomyProperties.parse(body)
    .results.filter((p) => p.supports_variations !== false)
    .map((p) => ({
      propertyId: p.property_id,
      name: p.display_name || p.name,
      scales: (p.scales ?? []).map((s) => ({ scaleId: s.scale_id, name: s.display_name })),
      values: (p.possible_values ?? []).map((v) => ({ valueId: v.value_id, name: v.name, scaleId: v.scale_id ?? null })),
    }));
}

export function pickSizeProperty(properties: readonly VariationProperty[]): VariationProperty | undefined {
  return properties.find((p) => SIZE_PROPERTY.test(p.name.trim()));
}

export function pickColorProperty(properties: readonly VariationProperty[]): VariationProperty | undefined {
  return properties.find((p) => COLOR_PROPERTY.test(p.name.trim())) ?? properties.find((p) => ANY_COLOR_PROPERTY.test(p.name));
}

// The size scale with the most letter sizes (S, M, L, XL, …), e.g. "Letter" over "Numeric".
export function pickSizeScale(size: VariationProperty): number | undefined {
  let best: { scaleId: number; letters: number } | undefined;
  for (const scale of size.scales) {
    const letters = size.values.filter((v) => v.scaleId === scale.scaleId && LETTER_SIZES.has(v.name.trim().toLowerCase())).length;
    if (letters > 0 && (best === undefined || letters > best.letters)) best = { scaleId: scale.scaleId, letters };
  }
  return best?.scaleId;
}

export type ShopReference = {
  shippingProfiles: ShippingProfile[];
  returnPolicies: ReturnPolicy[];
  processingProfiles: ProcessingProfile[];
  sections: ShopSection[];
  tshirtCandidates: TaxonomyMatch[];
  tshirt: TaxonomyMatch | undefined;
  variationProperties: VariationProperty[];
  size: VariationProperty | undefined;
  sizeScaleId: number | undefined;
  color: VariationProperty | undefined;
};

// `etsyFetch` must carry the shop's OAuth token (withAuth): shipping and processing
// profiles need shops_r.
export async function fetchShopReference(etsyFetch: EtsyFetch, shopId: number): Promise<ShopReference> {
  const get = async (path: string): Promise<unknown> => (await etsyFetch(path)).json();
  const shop = `/v3/application/shops/${shopId}`;

  const shippingProfiles = parseShippingProfiles(await get(`${shop}/shipping-profiles`));
  const returnPolicies = parseReturnPolicies(await get(`${shop}/policies/return`));
  const processingProfiles: ProcessingProfile[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { count, profiles } = parseProcessingProfiles(
      await get(`${shop}/readiness-state-definitions?limit=${PAGE_LIMIT}&offset=${page * PAGE_LIMIT}`),
    );
    processingProfiles.push(...profiles);
    if (profiles.length < PAGE_LIMIT || processingProfiles.length >= count) break;
  }
  const sections = parseSections(await get(`${shop}/sections`));

  const tshirtCandidates = findTshirtNodes(await get('/v3/application/seller-taxonomy/nodes'));
  const tshirt = pickTshirtNode(tshirtCandidates);
  const variationProperties = tshirt
    ? parseVariationProperties(await get(`/v3/application/seller-taxonomy/nodes/${tshirt.id}/properties?supports_variations=true`))
    : [];
  const size = pickSizeProperty(variationProperties);

  return {
    shippingProfiles,
    returnPolicies,
    processingProfiles,
    sections,
    tshirtCandidates,
    tshirt,
    variationProperties,
    size,
    sizeScaleId: size ? pickSizeScale(size) : undefined,
    color: pickColorProperty(variationProperties),
  };
}
