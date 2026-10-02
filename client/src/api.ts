// Calls to the server's /api routes. Responses are checked at runtime: TypeScript can't
// see across the network, and fetch's json() is untyped.

export const ETSY_DAILY_LIMIT = 5000; // calls per rolling 24 h for the app's API key (SPEC.md → Rate limits)

export type ShopStatus =
  | { connected: false; callsLast24h: number }
  | {
      connected: true;
      name: string;
      accessExpiresAt: number; // epoch ms
      refreshExpiresAt: number; // epoch ms; reconnecting is needed after this
      reconnectSoon: boolean; // the refresh token expires within 14 days
      callsLast24h: number;
    };

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function getJson(path: string, method = 'GET'): Promise<unknown> {
  const res = await fetch(path, { method, headers: { accept: 'application/json' } });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = isRecord(body) && typeof body['error'] === 'string' ? body['error'] : `HTTP ${res.status}`;
    throw new ApiError(res.status, error);
  }
  return body;
}

function unexpected(path: string): ApiError {
  return new ApiError(0, `Unexpected response from ${path}`);
}

export async function getShop(): Promise<ShopStatus> {
  const body = await getJson('/api/shop');
  if (!isRecord(body)) throw unexpected('/api/shop');
  const { connected, callsLast24h, name, accessExpiresAt, refreshExpiresAt, reconnectSoon } = body;
  if (typeof callsLast24h !== 'number') throw unexpected('/api/shop');
  if (connected === false) return { connected, callsLast24h };
  if (
    connected !== true ||
    typeof name !== 'string' ||
    typeof accessExpiresAt !== 'number' ||
    typeof refreshExpiresAt !== 'number' ||
    typeof reconnectSoon !== 'boolean'
  ) {
    throw unexpected('/api/shop');
  }
  return { connected, name, accessExpiresAt, refreshExpiresAt, reconnectSoon, callsLast24h };
}

// Shapes served by /api/settings and /api/reference. The server builds both with zod
// (settings are validated before they are stored; Etsy data is parsed as it arrives), so
// the client only checks the envelope.

export type FieldError = { field: string; reason: string }; // field like "sizes[0].price"

export type EtsyValue = { valueId: number; name: string };
export type Settings = {
  etsy: {
    taxonomyId: number;
    sizePropertyId: number;
    sizePropertyName: string;
    sizeScaleId: number;
    colorPropertyId: number;
    colorPropertyName: string;
  };
  sizes: Array<{ name: string; etsy: EtsyValue; price: number }>;
  colors: Array<{ name: string; etsy: EtsyValue | null }>;
  quantity: number;
  skuPattern: string | null;
  itemSize: {
    weight: number;
    weightUnit: WeightUnit;
    length: number;
    width: number;
    height: number;
    dimensionsUnit: DimensionsUnit;
  };
  listing: { shippingProfileId: number; returnPolicyId: number; readinessStateId: number; shopSectionId: number | null };
  materials: string[];
  footer: string;
  voice: string;
  bannedTerms: string[];
};
export const WEIGHT_UNITS = ['oz', 'lb', 'g', 'kg'] as const;
export const DIMENSIONS_UNITS = ['in', 'ft', 'mm', 'cm', 'm', 'yd'] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];
export type DimensionsUnit = (typeof DIMENSIONS_UNITS)[number];

export type VariationProperty = {
  propertyId: number;
  name: string;
  scales: Array<{ scaleId: number; name: string }>;
  values: Array<{ valueId: number; name: string; scaleId: number | null }>;
};
export type TaxonomyMatch = { id: number; path: string[] };
// Fields the server leaves undefined are missing from the JSON, hence the optional ones.
export type ShopReference = {
  shippingProfiles: Array<{ id: number; title: string; originCountry: string | null }>;
  returnPolicies: Array<{ id: number; acceptsReturns: boolean; acceptsExchanges: boolean; returnDeadlineDays: number | null }>;
  processingProfiles: Array<{ id: number; readinessState: string; label: string }>;
  sections: Array<{ id: number; title: string }>;
  tshirtCandidates: TaxonomyMatch[];
  tshirt?: TaxonomyMatch;
  size?: VariationProperty;
  sizeScaleId?: number;
  color?: VariationProperty;
};

export type StoredSettings = { settings: Settings | null; updatedAt: number | null };

function hasKeys<T>(path: string, body: unknown, keys: readonly string[]): T {
  if (!isRecord(body) || !keys.every((key) => key in body)) throw unexpected(path);
  return body as T; // the server's own zod-checked data; see the note above
}

export async function getSettings(): Promise<StoredSettings> {
  return hasKeys('/api/settings', await getJson('/api/settings'), ['settings', 'updatedAt']);
}

const REFERENCE_KEYS = ['shippingProfiles', 'returnPolicies', 'processingProfiles', 'sections', 'tshirtCandidates'];

export async function getReference(): Promise<ShopReference> {
  return hasKeys('/api/reference', await getJson('/api/reference'), REFERENCE_KEYS);
}

export async function refreshReference(): Promise<ShopReference> {
  return hasKeys('/api/reference/refresh', await getJson('/api/reference/refresh', 'POST'), REFERENCE_KEYS);
}

export type SaveResult = { ok: true; saved: { settings: Settings; updatedAt: number } } | { ok: false; errors: FieldError[] };

// `settings` may be incomplete: the server's field errors are what the form shows.
export async function saveSettings(settings: unknown): Promise<SaveResult> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(settings),
  });
  const body: unknown = await res.json().catch(() => null);
  if (res.status === 400 && isRecord(body) && Array.isArray(body['errors'])) {
    return { ok: false, errors: hasKeys<{ errors: FieldError[] }>('/api/settings', body, ['errors']).errors };
  }
  if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
  return { ok: true, saved: hasKeys('/api/settings', body, ['settings', 'updatedAt']) };
}
