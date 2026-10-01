# Task list

Plan: [plan.md](plan.md). Spec: [SPEC.md](../SPEC.md).

**Every task** is verified with `npm run typecheck` and `npm test`, plus its own check below. At a **CHECKPOINT** line, stop and report before going on.

## Phase 0: Foundation

- [x] **T1: Server skeleton with local-only protection** (done 2026-10-01; `@hono/node-server` was replaced by our own `server/src/http/serve.ts`, see SPEC Tech stack)
  - **Acceptance:**
    - `hono` is installed with an exact pin and passes typecheck. The server runs through our own adapter, which has its own tests.
    - The server listens on `127.0.0.1:3003`. `GET /api/health` → `{ok:true}`.
    - The middleware rejects a foreign `Host` or `Origin` with 403 and sets the spec's security headers.
    - A root `npm test` runs `node --test` across the server workspace.
  - **Verify:**
    - Unit tests for the Host/Origin rules.
    - `curl -H "Origin: https://evil.example" localhost:3003/api/health` → 403.
  - **Files:** `package.json`, `server/package.json`, `server/src/app.ts`, `server/src/index.ts`, `server/src/http/serve.ts` (+ test), `server/src/http/local-only.ts` (+ test), `CLAUDE.md`
- [x] **T2: SQLite database and schema** (done 2026-10-01; STRICT tables, timestamps in epoch ms, foreign keys with cascade from batches → items → images)
  - **Acceptance:**
    - `db.ts` opens `data/app.db` (created if missing) and applies the spec schema with `PRAGMA user_version`.
    - The single-row checks on `shop` and `settings` are enforced.
  - **Verify:** tests on `:memory:` check that the schema is created, that a second `shop` row is rejected, and that migration twice is a no-op.
  - **Files:** `server/src/db.ts`, `server/src/db.test.ts`
- [x] **T3: Etsy HTTP client, throttle and `etsy:check`** (done 2026-10-01; ping is `GET /v3/application/openapi-ping` (`ping`), base `https://api.etsy.com` as in Etsy's docs, though the OpenAPI `servers` entry says `openapi.etsy.com`; live check returned 200)
  - **Acceptance:**
    - `etsyFetch` sends `x-api-key: keystring:secret`.
    - The throttle allows at most 4 req/s and honors `retry-after` with exponential backoff.
    - Every call is logged to `etsy_calls` with `remaining_today`.
    - `npm run etsy:check` calls Etsy's ping endpoint (endpoint name checked in the OpenAPI spec) and prints the result.
  - **Verify:**
    - Fake-fetch tests: header, throttle spacing, 429 → retry, logging.
    - Live `npm run etsy:check`.
  - **Files:** `server/src/etsy/client.ts`, `server/src/etsy/throttle.ts`, `server/src/etsy/client.test.ts`, `server/src/etsy-check.ts`, `server/package.json` (+ `CLAUDE.md`)
- [x] **CHECKPOINT A:** `etsy:check` gets a 200 from Etsy with your credentials. (approved 2026-10-01; two logged pings, both HTTP 200)

## Phase 1: etsy-connect

- [x] **T4: OAuth connect** (done 2026-10-01; routes live in `server/src/app.ts`; shop resolved via `getMe` → `getShop`; the live consent is part of Checkpoint B)
  - **Acceptance:**
    - `/oauth/start` redirects to Etsy with PKCE S256, a random `state` and the scopes `listings_r listings_w shops_r`.
    - `/oauth/redirect` checks `state` (single use, 10-minute expiry), exchanges the code, resolves the shop (user → shop) and stores the `shop` row.
    - A different `etsy_shop_id` than the stored one is refused.
  - **Verify:** tests for PKCE generation, `state` handling, same-shop refusal, and a token exchange against a fake `fetch`.
  - **Files:** `server/src/etsy/oauth.ts`, `server/src/etsy/oauth.test.ts`, `server/src/etsy/token-store.ts`, `server/src/index.ts`
- [x] **T5: Token refresh** (done 2026-10-01; `createAccessTokens` in `token-store.ts`, `withAuth` in `client.ts`, `/api/shop` in `app.ts`; the live "shows the shop and expiry" output waits for the connection at Checkpoint B)
  - **Acceptance:**
    - Expired access tokens refresh before use, single-flight.
    - A 401 triggers one refresh and one retry.
    - New tokens are saved before use.
    - `/api/shop` returns the shop name, token expiry, refresh-expiry warning (14 days) and the rolling-24h call count.
  - **Verify:**
    - Tests: two concurrent calls on an expired token produce exactly one refresh.
    - `etsy:check` shows the shop and expiry.
  - **Files:** `server/src/etsy/token-store.ts`, `server/src/etsy/client.ts`, `server/src/etsy/token-store.test.ts`, `server/src/etsy-check.ts`
- [ ] **T6: Shop reference data**
  - **Acceptance:** `reference.ts` fetches:
    - shipping profiles, return policies, processing profiles and sections
    - the T-shirt taxonomy node, found by walking `getSellerTaxonomyNodes`
    - the size/color property ids, size scale id and value ids from `getPropertiesByTaxonomyId?supports_variations=true`

    `npm run etsy:reference` prints all of it.
  - **Verify:**
    - Tests for parsing recorded response shapes and finding the taxonomy node.
    - Live `etsy:reference`.
  - **Files:** `server/src/etsy/reference.ts`, `server/src/etsy/reference.test.ts`, `server/src/etsy-reference.ts`, `server/package.json` (+ `CLAUDE.md`)
- [ ] **CHECKPOINT B:** you connect the shop in the browser via `localhost:3003/oauth/start`. `etsy:reference` output is reviewed together.

## Phase 2: draft-publisher

- [ ] **T7: Inventory payload builder**
  - **Acceptance:** a pure function builds the `updateListingInventory` payload. It includes:
    - one product per size × color, each with SKU, price by size, quantity and `readiness_state_id`
    - the size property with its `scale_id`
    - the color property with mapped value ids, or custom values where there's no match
    - the `*_on_property` arrays

    Value strings are validated.
  - **Verify:** table-driven tests, including a color with parentheses (rejected) and an unmapped color (sent as a custom value).
  - **Files:** `server/src/publisher/inventory.ts`, `server/src/publisher/inventory.test.ts`
- [ ] **T8: Resumable push pipeline**
  - **Acceptance:** `publish(itemId)` implements the spec's algorithm:
    - `push_started_at` → create → `etsy_listing_id`
    - images with `rank` + `overwrite` → `etsy_image_id`
    - inventory, then `push_step`
    - adopts a matching draft on a retry after a crash
  - **Verify:** fake-fetch tests kill the push before the id is saved, after `image:3` and before inventory. Each retry ends with exactly one create and each image once.
  - **Files:** `server/src/publisher/publish.ts`, `server/src/publisher/publish.test.ts`, `server/src/etsy/listings.ts`
- [ ] **T9: Live sample draft**
  - **Acceptance:** `scripts/publish-sample.mts` creates one draft. It has fixed harmless text, 2 sample images, sizes S/M × colors Black/White at placeholder prices, and the first processing, shipping and return profiles from reference data. It then reads the listing back and prints it.
  - **Verify:** run it once. Record in SPEC.md any field rule Etsy enforces differently.
  - **Files:** `scripts/publish-sample.mts`, `scripts/tsconfig.json`, `package.json` (typecheck wiring), `SPEC.md` (only if facts changed)
- [ ] **CHECKPOINT C:** you open the draft in Shop Manager, confirm the photos, variations and prices, then delete it.

## Phase 3: shop-settings and the client shell

- [ ] **T10: Etsy text rules**
  - **Acceptance:** `guard/rules.ts` validates title, tags, materials, styles, alt text and variation value strings, with the regexes copied from the OpenAPI spec. Each error names the field and the reason.
  - **Verify:** table-driven tests, including math symbols in a title and a tag at exactly 20 and at 21 characters.
  - **Files:** `server/src/guard/rules.ts`, `server/src/guard/rules.test.ts`
- [ ] **T11: Settings API**
  - **Acceptance:**
    - `GET`/`PUT /api/settings` covers the full settings: sizes, colors with Etsy value mapping, price per size, quantity, SKU pattern, listing defaults (profile ids), materials, footer, voice and banned terms. It is checked with a zod schema and with `rules.ts`.
    - `GET /api/reference` serves the cached reference data.
  - **Verify:** tests for schema validation and for rule errors in the footer and colors.
  - **Files:** `server/src/settings/settings.ts`, `server/src/settings/routes.ts`, `server/src/settings/settings.test.ts`, `server/src/index.ts`
- [ ] **T12: Client scaffold (proves TS 7 compatibility)**
  - **Acceptance:**
    - `client/` is a module workspace with React 19.3, Vite 8.3 and plugin-react 6.1, pinned exactly.
    - Its `tsconfig` extends the base and is included in `npm run typecheck`, which passes with `skipLibCheck: false`.
    - `vite build` succeeds.
  - **Verify:** typecheck and build. If the types fail, apply the spec's fallback or stop and ask.
  - **Files:** `client/package.json`, `client/tsconfig.json`, `client/vite.config.ts`, `client/index.html`, `client/src/main.tsx`
- [ ] **T13: Dev runner, `npm start` and the Connect page**
  - **Acceptance:**
    - `npm run dev` starts both processes with Vite proxying `/api` and `/oauth`, and Ctrl+C stops both.
    - `npm start` builds and the server serves `client/dist`.
    - The app shell has the Etsy trademark footer.
    - The Connect page shows connection status, a Connect button, the expiry warning and the daily call count.
  - **Verify:**
    - Browser pass at `:3003` and `:5173`.
    - The spec's security headers appear on the page response.
  - **Files:** `scripts/dev.mts`, `package.json`, `server/src/index.ts`, `client/src/App.tsx`, `client/src/pages/Connect.tsx` (+ `CLAUDE.md`)
- [ ] **T14: Settings page**
  - **Acceptance:**
    - A form for every setting: profile dropdowns filled from reference data, a color → Etsy color value mapping, and a price-per-size table.
    - Server validation errors appear next to their fields.
  - **Verify:** browser pass, then save and reload.
  - **Files:** `client/src/pages/Settings.tsx`, `client/src/api.ts`, `client/src/App.tsx`
- [ ] **CHECKPOINT D:** you enter your real product details in Settings. **Needs your sizes, colors, prices, quantity, SKU format and footer.**

## Phase 4: batch-review

- [ ] **T15: Intake API**
  - **Acceptance:** `POST /api/batches` is a multipart upload that:
    - checks magic bytes (JPG/PNG), the 20 MB cap and the per-batch cap
    - stores files under server-generated names
    - applies natural sort, skip and cap rules, and returns the warnings
    - creates the batch, item and image rows
  - **Verify:** tests for a `../x.png` name, a `.heic` file, `Thumbs.db`, 21 images, `2.png` vs `10.png` order, and an empty folder.
  - **Files:** `server/src/batches/intake.ts`, `server/src/batches/intake.test.ts`, `server/src/batches/routes.ts`, `server/src/index.ts`
- [ ] **T16: Intake UI**
  - **Acceptance:**
    - A folder picker groups files by subfolder.
    - A canvas makes the previews at the size the spec sets.
    - Upload progress and skip warnings are shown.
  - **Verify:** browser pass with a test folder.
  - **Files:** `client/src/pages/Batch.tsx`, `client/src/lib/previews.ts`, `client/src/api.ts`
- [ ] **T17: Item state machine and item API**
  - **Acceptance:**
    - A pure state machine implements the spec's flow.
    - The routes edit content, reorder images, set colors and approve. Zero colors can't be approved, and illegal moves → 409.
  - **Verify:** state-machine tests and route tests.
  - **Files:** `server/src/batches/items.ts`, `server/src/batches/items.test.ts`, `server/src/batches/routes.ts`
- [ ] **T18: Review UI**
  - **Acceptance:**
    - An editor for each item: fields, image order, colors, approve.
    - Untrusted text is rendered as text only.
    - The Push button is present but disabled ("Guard not built yet").
  - **Verify:** browser pass.
  - **Files:** `client/src/pages/Review.tsx`, `client/src/components/ItemEditor.tsx`, `client/src/api.ts`
- [ ] **CHECKPOINT E:** a real batch folder of yours goes through intake and review.

## Phase 5: copywriter

- [ ] **T19: Output normalization**
  - **Acceptance:** normalization follows the spec's tag, title, color and alt-text rules, and it never throws.
  - **Verify:** table-driven tests, including 12 tags, a 21-character tag, duplicates and an unknown color.
  - **Files:** `server/src/copywriter/normalize.ts`, `server/src/copywriter/normalize.test.ts`
- [ ] **T20: Claude generation**
  - **Acceptance:**
    - `@anthropic-ai/sdk` is pinned and passes typecheck. SDK calls are checked against the claude-api skill first.
    - `generate.ts` calls `client.beta.messages.parse` with these settings:
      - model `claude-opus-5-5`, effort `medium`
      - `fallbacks: "default"` + its beta header
      - a loose zod schema
    - It handles a `refusal`.
    - At most 2 calls run at a time. Token usage is logged.
    - Routes generate one item, a whole batch, or N more tags.
  - **Verify:**
    - Tests with a fake client: refusal → `failed`; good output → normalized content.
    - A live run on one sample design.
  - **Files:** `server/src/copywriter/prompt.ts`, `server/src/copywriter/generate.ts`, `server/src/copywriter/generate.test.ts`, `server/src/batches/routes.ts`, `server/package.json`
- [ ] **T21: Generation UI**
  - **Acceptance:** Generate (batch and item), per-item status, retry on failure, and the "N tags missing → suggest more" button.
  - **Verify:** browser pass on a real batch.
  - **Files:** `client/src/pages/Review.tsx`, `client/src/components/ItemEditor.tsx`, `client/src/api.ts`
- [ ] **CHECKPOINT F:** you judge 3 generated listings. The prompt is tuned from your feedback.

## Phase 6: listing-guard

- [ ] **T22: Banned-terms matcher**
  - **Acceptance:** the matcher follows the spec's normalization: case, accents, punctuation and character swaps. Short terms match whole words only; longer terms also match inside words. A seed list is included.
  - **Verify:** tests for "N1ke", "Swifties", "nfl" vs "unflappable", and an accented spelling.
  - **Files:** `server/src/guard/banned-terms.ts`, `server/src/guard/banned-terms.test.ts`, `server/src/guard/seed-terms.ts`
- [ ] **T23: Jev IP check, overrides and the push decision**
  - **Acceptance:**
    - Phrases are pulled from every published field.
    - Jev `noul` calls are split across calls when the input is too large.
    - `classify` sorts each phrase into block, warn or ok. Decisions are logged.
    - Overrides are tied to the exact phrase text.
    - `canPush` combines rules, banned terms, Jev results and overrides. "Jev unreachable" can't be overridden.
  - **Verify:** tests with a fake Jev client cover thresholds, an override cancelled by an edit, Jev down → blocked, and the input split.
  - **Files:** `server/src/guard/ip-check.ts`, `server/src/guard/guard.ts`, `server/src/guard/guard.test.ts`
- [ ] **T24: Guard eval script**
  - **Acceptance:** `scripts/guard-eval.mts` runs the guard against ~25 must-block and ~25 must-pass phrases and prints the misses and the probability spread.
  - **Verify:** run it live and report the numbers. **Ask before changing thresholds.**
  - **Files:** `scripts/guard-eval.mts`, `scripts/guard-eval-phrases.ts`
- [ ] **T25: Guard wiring and pushing turned on**
  - **Acceptance:**
    - The guard runs on every content change and again at push time on the exact payload.
    - The review UI shows each verdict and allows an override with a typed reason.
    - Push is enabled: a sequential queue calls `publish`.
    - A pushed item shows the pre-publish checklist and a link to the draft in Etsy.
  - **Verify:**
    - Tests: the push route refuses a blocked item.
    - Browser pass: one real push of a guarded item.
  - **Files:** `server/src/batches/routes.ts`, `server/src/batches/push-queue.ts`, `client/src/components/ItemEditor.tsx`, `client/src/components/GuardPanel.tsx`
- [ ] **CHECKPOINT G:** eval numbers are accepted, and the first guarded real draft is confirmed in Shop Manager.

## Phase 7: Acceptance

- [ ] **T26: Success-criteria run and docs**
  - **Acceptance:**
    - Spec success criteria 1–9 are checked on a 10-design batch.
    - The kill-during-push checks are run.
    - The `curl` origin checks are run.
    - The README covers quick start, commands and architecture, and links to SPEC.md.
    - CLAUDE.md is current.
  - **Verify:** a checklist with evidence for each criterion.
  - **Files:** `README.md`, `CLAUDE.md`, `tasks/todo.md`
- [ ] **CHECKPOINT H:** final acceptance.
