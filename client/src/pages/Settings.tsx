// The shop's defaults: Etsy product type, sizes and prices, colors, inventory, packed size,
// listing profiles, materials, footer, voice and banned terms. Dropdowns come from the
// shop's Etsy reference data. The server validates on save; its errors show next to
// their fields and in a list at the top.
import { type FormEvent, type ReactNode, useEffect, useId, useState } from 'react';
import {
  ApiError,
  DIMENSIONS_UNITS,
  type FieldError,
  getReference,
  getSettings,
  refreshReference,
  saveSettings,
  type ShopReference,
  WEIGHT_UNITS,
} from '../api.ts';
import { type ColorRow, type Draft, draftFromSettings, emptyDraft, errorsAt, errorsUnder, rowKey, type SizeRow, toSettings } from '../settings-draft.ts';

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; reference: ShopReference; draft: Draft; updatedAt: number | null };

const savedTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function loadError(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) return 'Connect your Etsy shop first: Settings needs its profiles and size and color values.';
  if (error instanceof ApiError && error.status === 503) return 'Etsy is not configured. Set ETSY_KEYSTRING and ETSY_SHARED_SECRET in .env, then restart the server.';
  if (error instanceof ApiError) return error.message;
  return 'Could not reach the server. Is it running?';
}

export function Settings() {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    Promise.all([getReference(), getSettings()]).then(
      ([reference, stored]) => {
        if (cancelled) return;
        const draft = stored.settings ? draftFromSettings(stored.settings) : emptyDraft(reference);
        setLoad({ kind: 'ready', reference, draft, updatedAt: stored.updatedAt });
      },
      (error: unknown) => !cancelled && setLoad({ kind: 'error', message: loadError(error) }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (load.kind === 'loading') return <p className="muted">Loading settings and your shop's Etsy data…</p>;
  if (load.kind === 'error') return <p className="notice notice-error" role="alert">{load.message}</p>;
  return <SettingsForm initialReference={load.reference} initialDraft={load.draft} initialUpdatedAt={load.updatedAt} />;
}

function returnPolicyLabel(policy: ShopReference['returnPolicies'][number]): string {
  if (!policy.acceptsReturns && !policy.acceptsExchanges) return 'No returns or exchanges';
  const what = policy.acceptsReturns && policy.acceptsExchanges ? 'Returns and exchanges' : policy.acceptsReturns ? 'Returns' : 'Exchanges';
  return policy.returnDeadlineDays === null ? what : `${what} within ${policy.returnDeadlineDays} days`;
}

function SettingsForm(props: { initialReference: ShopReference; initialDraft: Draft; initialUpdatedAt: number | null }) {
  const [reference, setReference] = useState(props.initialReference);
  const [draft, setDraft] = useState(props.initialDraft);
  const [updatedAt, setUpdatedAt] = useState(props.initialUpdatedAt);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'invalid' | 'failed' | 'refreshing'>('idle');

  const set = <K extends keyof Draft>(key: K, value: Draft[K]): void => setDraft((d) => ({ ...d, [key]: value }));
  const scaleValues = (reference.size?.values ?? []).filter((v) => String(v.scaleId) === draft.sizeScaleId);
  const colorValues = reference.color?.values ?? [];

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    setStatus('saving');
    try {
      const result = await saveSettings(toSettings(draft, reference));
      if (result.ok) {
        setErrors([]);
        setUpdatedAt(result.saved.updatedAt);
        setStatus('saved');
      } else {
        setErrors(result.errors);
        setStatus('invalid');
      }
    } catch {
      setStatus('failed');
    }
  }

  async function refresh(): Promise<void> {
    setStatus('refreshing');
    try {
      setReference(await refreshReference());
      setStatus('idle');
    } catch {
      setStatus('failed');
    }
  }

  // Sizes
  const updateSize = (key: number, change: Partial<SizeRow>): void =>
    set('sizes', draft.sizes.map((row) => (row.key === key ? { ...row, ...change } : row)));
  const chooseEtsySize = (row: SizeRow, valueId: string): void => {
    const value = scaleValues.find((v) => String(v.valueId) === valueId);
    updateSize(row.key, { valueId, ...(row.name.trim() === '' && value ? { name: value.name } : {}) });
  };
  const addAllSizes = (): void => {
    const present = new Set(draft.sizes.map((row) => row.valueId));
    const added = scaleValues.filter((v) => !present.has(String(v.valueId)));
    set('sizes', [...draft.sizes, ...added.map((v) => ({ key: rowKey(), name: v.name, valueId: String(v.valueId), price: '' }))]);
  };

  // Colors: typing a name that matches an Etsy color picks it, unless one is already chosen.
  const updateColor = (key: number, change: Partial<ColorRow>): void =>
    set('colors', draft.colors.map((row) => (row.key === key ? { ...row, ...change } : row)));
  const nameColor = (row: ColorRow, name: string): void => {
    const match = colorValues.find((v) => v.name.toLowerCase() === name.trim().toLowerCase());
    updateColor(row.key, { name, ...(row.valueId === '' && match ? { valueId: String(match.valueId) } : {}) });
  };

  const missing = [!reference.tshirt && 'the T-shirt category', !reference.size && 'the size property', !reference.color && 'the color property'].filter(
    (m) => m !== false,
  );

  return (
    <form className="settings" onSubmit={save} noValidate>
      <section aria-labelledby="etsy-title">
        <div className="section-head">
          <h2 id="etsy-title">Etsy product type</h2>
          <button type="button" className="button button-secondary" onClick={refresh} disabled={status === 'refreshing'}>
            {status === 'refreshing' ? 'Reloading…' : 'Reload shop data from Etsy'}
          </button>
        </div>
        {missing.length > 0 && (
          <p className="notice notice-warning">Etsy's data didn't identify {missing.join(', ')}. Choose below where you can.</p>
        )}
        <div className="grid">
          <Field label="Category" errors={errorsUnder(errors, 'etsy.taxonomyId')}>
            {(id, described) => (
              <select id={id} {...described} value={draft.taxonomyId} onChange={(e) => set('taxonomyId', e.target.value)}>
                <option value="">Choose…</option>
                {reference.tshirtCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.path.join(' › ')}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Size scale" errors={errorsUnder(errors, 'etsy.sizeScaleId')}>
            {(id, described) => (
              <select id={id} {...described} value={draft.sizeScaleId} onChange={(e) => set('sizeScaleId', e.target.value)}>
                <option value="">Choose…</option>
                {(reference.size?.scales ?? []).map((s) => (
                  <option key={s.scaleId} value={s.scaleId}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <Problems messages={[...errorsUnder(errors, 'etsy.sizePropertyId'), ...errorsUnder(errors, 'etsy.colorPropertyId')]} />
      </section>

      <section aria-labelledby="sizes-title">
        <h2 id="sizes-title">Sizes and prices</h2>
        <p className="muted">Your name for each size goes into SKUs; buyers see the Etsy size. Prices are per size, in your shop's currency.</p>
        <table className="rows">
          <thead>
            <tr>
              <th scope="col">Your name</th>
              <th scope="col">Etsy size</th>
              <th scope="col">Price</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {draft.sizes.map((row, i) => (
              <tr key={row.key}>
                <td>
                  <input aria-label={`Size ${i + 1} name`} value={row.name} onChange={(e) => updateSize(row.key, { name: e.target.value })} />
                  <Problems messages={errorsAt(errors, `sizes[${i}].name`)} />
                </td>
                <td>
                  <select aria-label={`Size ${i + 1} Etsy size`} value={row.valueId} onChange={(e) => chooseEtsySize(row, e.target.value)}>
                    <option value="">Choose…</option>
                    {scaleValues.map((v) => (
                      <option key={v.valueId} value={v.valueId}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                  <Problems messages={errorsUnder(errors, `sizes[${i}].etsy`)} />
                </td>
                <td>
                  <input
                    aria-label={`Size ${i + 1} price`}
                    inputMode="decimal"
                    className="narrow"
                    value={row.price}
                    onChange={(e) => updateSize(row.key, { price: e.target.value })}
                  />
                  <Problems messages={errorsAt(errors, `sizes[${i}].price`)} />
                </td>
                <td>
                  <RowActions label={`size ${i + 1}`} index={i} rows={draft.sizes} onChange={(rows) => set('sizes', rows)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Problems messages={errorsAt(errors, 'sizes')} />
        <div className="actions">
          <button type="button" className="button button-secondary" onClick={() => set('sizes', [...draft.sizes, { key: rowKey(), name: '', valueId: '', price: '' }])}>
            Add size
          </button>
          <button type="button" className="button button-secondary" onClick={addAllSizes} disabled={scaleValues.length === 0}>
            Add every size on this scale
          </button>
        </div>
      </section>

      <section aria-labelledby="colors-title">
        <h2 id="colors-title">Colors</h2>
        <p className="muted">
          Map each of your colors to Etsy's color, which buyers filter by. A color with no Etsy match is sent as a custom value. Etsy
          doesn't allow parentheses in color names.
        </p>
        <table className="rows">
          <thead>
            <tr>
              <th scope="col">Your name</th>
              <th scope="col">Etsy color</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {draft.colors.map((row, i) => (
              <tr key={row.key}>
                <td>
                  <input aria-label={`Color ${i + 1} name`} value={row.name} onChange={(e) => nameColor(row, e.target.value)} />
                  <Problems messages={errorsAt(errors, `colors[${i}].name`)} />
                </td>
                <td>
                  <select aria-label={`Color ${i + 1} Etsy color`} value={row.valueId} onChange={(e) => updateColor(row.key, { valueId: e.target.value })}>
                    <option value="">No match (custom value)</option>
                    {colorValues.map((v) => (
                      <option key={v.valueId} value={v.valueId}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                  <Problems messages={errorsUnder(errors, `colors[${i}].etsy`)} />
                </td>
                <td>
                  <RowActions label={`color ${i + 1}`} index={i} rows={draft.colors} onChange={(rows) => set('colors', rows)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Problems messages={errorsAt(errors, 'colors')} />
        <div className="actions">
          <button type="button" className="button button-secondary" onClick={() => set('colors', [...draft.colors, { key: rowKey(), name: '', valueId: '' }])}>
            Add color
          </button>
        </div>
      </section>

      <section aria-labelledby="inventory-title">
        <h2 id="inventory-title">Inventory and SKUs</h2>
        <div className="grid">
          <Field label="Quantity per size and color" errors={errorsAt(errors, 'quantity')}>
            {(id, described) => <input id={id} {...described} inputMode="numeric" className="narrow" value={draft.quantity} onChange={(e) => set('quantity', e.target.value)} />}
          </Field>
          <div>
            <label className="check">
              <input type="checkbox" checked={draft.sendSkus} onChange={(e) => set('sendSkus', e.target.checked)} /> Send SKUs
            </label>
            {draft.sendSkus && (
              <Field label="SKU pattern" hint="Use {design}, {size} and {color}." errors={errorsAt(errors, 'skuPattern')}>
                {(id, described) => <input id={id} {...described} value={draft.skuPattern} onChange={(e) => set('skuPattern', e.target.value)} />}
              </Field>
            )}
          </div>
        </div>
        <Problems messages={errorsAt(errors, 'design')} />
      </section>

      <section aria-labelledby="size-title">
        <h2 id="size-title">Packed size of one shirt</h2>
        <p className="muted">Your calculated shipping profile needs the weight and dimensions of every listing.</p>
        <div className="grid">
          <Field label="Weight" errors={errorsAt(errors, 'itemSize.weight')}>
            {(id, described) => (
              <span className="with-unit">
                <input id={id} {...described} inputMode="decimal" className="narrow" value={draft.weight} onChange={(e) => set('weight', e.target.value)} />
                <select aria-label="Weight unit" value={draft.weightUnit} onChange={(e) => set('weightUnit', WEIGHT_UNITS.find((u) => u === e.target.value) ?? 'oz')}>
                  {WEIGHT_UNITS.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </span>
            )}
          </Field>
          {([['length', 'Length'], ['width', 'Width'], ['height', 'Height']] as const).map(([dimension, label]) => (
            <Field key={dimension} label={label} errors={errorsAt(errors, `itemSize.${dimension}`)}>
              {(id, described) => (
                <input id={id} {...described} inputMode="decimal" className="narrow" value={draft[dimension]} onChange={(e) => set(dimension, e.target.value)} />
              )}
            </Field>
          ))}
          <Field label="Dimensions unit" errors={[]}>
            {(id) => (
              <select id={id} value={draft.dimensionsUnit} onChange={(e) => set('dimensionsUnit', DIMENSIONS_UNITS.find((u) => u === e.target.value) ?? 'in')}>
                {DIMENSIONS_UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </section>

      <section aria-labelledby="listing-title">
        <h2 id="listing-title">Listing defaults</h2>
        <div className="grid">
          <Field label="Shipping profile" errors={errorsAt(errors, 'listing.shippingProfileId')}>
            {(id, described) => (
              <select id={id} {...described} value={draft.shippingProfileId} onChange={(e) => set('shippingProfileId', e.target.value)}>
                <option value="">Choose…</option>
                {reference.shippingProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title || `Profile ${p.id}`}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Return policy" errors={errorsAt(errors, 'listing.returnPolicyId')}>
            {(id, described) => (
              <select id={id} {...described} value={draft.returnPolicyId} onChange={(e) => set('returnPolicyId', e.target.value)}>
                <option value="">Choose…</option>
                {reference.returnPolicies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {returnPolicyLabel(p)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Processing profile" errors={errorsAt(errors, 'listing.readinessStateId')}>
            {(id, described) => (
              <select id={id} {...described} value={draft.readinessStateId} onChange={(e) => set('readinessStateId', e.target.value)}>
                <option value="">Choose…</option>
                {reference.processingProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label || p.readinessState}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Shop section" errors={errorsAt(errors, 'listing.shopSectionId')}>
            {(id, described) => (
              <select id={id} {...described} value={draft.shopSectionId} onChange={(e) => set('shopSectionId', e.target.value)}>
                <option value="">None</option>
                {reference.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <Field label="Materials" hint="Separate with commas. Letters, digits and spaces only." errors={errorsUnder(errors, 'materials')}>
          {(id, described) => <input id={id} {...described} value={draft.materials} onChange={(e) => set('materials', e.target.value)} />}
        </Field>
      </section>

      <section aria-labelledby="text-title">
        <h2 id="text-title">Description and voice</h2>
        <Field label="Description footer" hint="Added word for word after the description Claude writes: size chart, care, processing, shipping." errors={errorsAt(errors, 'footer')}>
          {(id, described) => <textarea id={id} {...described} rows={12} value={draft.footer} onChange={(e) => set('footer', e.target.value)} />}
        </Field>
        <Field label="Voice notes" hint="How Claude should write: tone, words to prefer or avoid." errors={errorsAt(errors, 'voice')}>
          {(id, described) => <textarea id={id} {...described} rows={4} value={draft.voice} onChange={(e) => set('voice', e.target.value)} />}
        </Field>
        <Field label="Banned terms" hint="One per line. A listing that mentions any of them is blocked." errors={errorsUnder(errors, 'bannedTerms')}>
          {(id, described) => <textarea id={id} {...described} rows={6} value={draft.bannedTerms} onChange={(e) => set('bannedTerms', e.target.value)} />}
        </Field>
      </section>

      <div className="save-bar">
        <button type="submit" className="button" disabled={status === 'saving'}>
          {status === 'saving' ? 'Saving…' : 'Save settings'}
        </button>
        <span role="status" className="muted">
          {status === 'saved' && updatedAt !== null && `Saved ${savedTime.format(updatedAt)}.`}
          {status === 'failed' && 'Could not reach the server. Nothing was saved.'}
          {status === 'idle' && updatedAt !== null && `Last saved ${savedTime.format(updatedAt)}.`}
          {status === 'idle' && updatedAt === null && 'Not saved yet.'}
        </span>
      </div>
      {status === 'invalid' && (
        <div className="notice notice-error" role="alert">
          <p>
            Nothing was saved. Fix {errors.length === 1 ? 'this problem' : `these ${errors.length} problems`}:
          </p>
          <ul>
            {errors.map((e, i) => (
              <li key={i}>
                <code>{e.field || 'settings'}</code>: {e.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}

type Described = { 'aria-describedby'?: string; 'aria-invalid'?: true };

function Field(props: { label: string; hint?: string; errors: string[]; children: (id: string, described: Described) => ReactNode }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-errors`;
  const describedBy = [props.hint ? hintId : '', props.errors.length > 0 ? errorId : ''].filter(Boolean).join(' ');
  const described: Described = {
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    ...(props.errors.length > 0 ? { 'aria-invalid': true } : {}),
  };
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      {props.children(id, described)}
      {props.hint && (
        <p id={hintId} className="hint">
          {props.hint}
        </p>
      )}
      <Problems id={errorId} messages={props.errors} />
    </div>
  );
}

function Problems(props: { id?: string; messages: string[] }) {
  if (props.messages.length === 0) return null;
  return (
    <ul id={props.id} className="problems">
      {props.messages.map((m, i) => (
        <li key={i}>{m}</li>
      ))}
    </ul>
  );
}

function RowActions<T>(props: { label: string; index: number; rows: T[]; onChange: (rows: T[]) => void }) {
  const { index, rows } = props;
  const move = (to: number): void => {
    const next = [...rows];
    const [row] = next.splice(index, 1);
    if (row === undefined) return;
    next.splice(to, 0, row);
    props.onChange(next);
  };
  return (
    <span className="row-actions">
      <button type="button" aria-label={`Move ${props.label} up`} disabled={index === 0} onClick={() => move(index - 1)}>
        ↑
      </button>
      <button type="button" aria-label={`Move ${props.label} down`} disabled={index === rows.length - 1} onClick={() => move(index + 1)}>
        ↓
      </button>
      <button type="button" aria-label={`Remove ${props.label}`} onClick={() => props.onChange(rows.filter((_, i) => i !== index))}>
        ✕
      </button>
    </span>
  );
}
