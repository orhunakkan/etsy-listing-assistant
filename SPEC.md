# Spec: Etsy Listing Assistant (MVP)

Status: **approved 2026-10-01 (v3, one shop)**. Implementation follows [tasks/plan.md](tasks/plan.md).

## Objective

A local web app that turns finished T-shirt designs and mockups into complete Etsy **draft** listings for **one Etsy shop**, in batches.

The seller runs several apparel shops and makes and ships the shirts themselves. The MVP serves one of those shops; see [Decisions](#decisions), D1. Today each listing is written and filled in by hand. The app should cut that to: drop in a folder of mockups, review the generated listings, and push them to Etsy as drafts. The seller then publishes each draft from Etsy's own listing editor.

**Avoiding IP warnings is a hard requirement.** The designs and mockups are original. The risk is the *listing text*: a brand, celebrity, team or character name in a title or tag can trigger a takedown even when the shirt itself is clean. The app must never push text it has not checked.

### User stories

1. **Connect my shop.** As the seller, I connect my Etsy shop once, and the app keeps the connection alive by refreshing tokens. If the app goes unused for 90 days, I need to reconnect once, because that's when Etsy's refresh token expires. The app warns me 14 days ahead.
2. **Set defaults once.** I set my shop defaults once: sizes and colors, price per size, shipping profile, return policy, processing profile, materials, description footer, banned terms and voice.
3. **Start a batch.** I drop in a folder with one subfolder per design. Each subfolder becomes one listing, with its mockups in file-name order.
4. **Get a full listing.** For each design the app writes a title, description, 13 tags and image alt text from the mockups, and suggests the shirt colors it sees.
5. **Review and edit.** I review and edit every field, and see why any item is blocked.
6. **Push as drafts.** I push the approved items, and each becomes an Etsy draft with photos in order, size × color variations, prices and SKUs.
7. **Retry safely.** A failed push can be retried without creating a duplicate listing.

### Non-goals (MVP)

- **More than one shop.** The app connects exactly one shop; see D1.
- **Publishing listings as active.** The app only ever creates drafts.
- **Existing listings and shop data.** No editing or syncing of live listings, orders or stats.
- **Print-on-demand integrations.** The seller makes the shirts.
- **Scanning the design artwork itself for IP.** The designs are original, so the app only transcribes text printed on the design and checks that text.
- **Hosting, multi-user accounts, payments.** The app must stay hostable later; see [Future expansion](#future-expansion-designed-for-not-built).

## Assumptions (correct any that are wrong)

1. **Folder layout.** The batch folder holds one subfolder per design. Mockups are sorted by *natural* name order (`2.png` before `10.png`), and the first one becomes the primary listing photo. The photo order can be changed during review. Intake rules:
   - **Accepted files:** only `.jpg`/`.jpeg`/`.png`, at most 20 MB each, with the type confirmed from the file's first bytes. Any other file (`Thumbs.db`, `.DS_Store`, HEIC, WebP, …) is skipped, and the batch shows a warning listing what was skipped.
   - **Wrong place:** files at the batch root and nested sub-subfolders are skipped with a warning. Empty design folders are skipped.
   - **Too many:** more than 20 images in a design → the first 20 are kept, with a warning.
   - **Names:** the design name is the subfolder name, cleaned up. Never trust the folder or file names the browser sends; the server names every stored file itself.
2. **One product model.** The shop sells unisex T-shirts with size × color variations.
   - **Price and quantity:** price varies by size only. Quantity and SKU are set per variation.
   - **Colors:** each item's colors come from the shop's color list. Claude's picks are only a suggestion. An item with zero colors can't be approved.
   - **Draft price and quantity:** the `price` and `quantity` sent to `createDraftListing` are the lowest size price and the default variation quantity. The inventory call then overwrites both.
3. **Fixed listing facts.** `who_made = i_did`, `when_made = made_to_order`, `type = physical`, `is_supply = false`.
4. **Who writes the description.** Claude writes the opening of the description. A fixed footer covering size chart, care, processing and shipping is appended word for word, so the AI never makes up policy text.
5. **No personalization** in the MVP.
6. **Processing profile.** The shop already has a "made to order" processing profile. The app picks an existing one and does not create one.
7. **API app.** The seller's existing Etsy API app ("listing-assistant", Personal Access, 5 QPS / 5K QPD) connects the shop. Since the shop is the seller's own, every access tier allows this.
   - **Credentials:** the keystring and shared secret live only in `.env`. Both are always visible under "Apps You've Made" in Etsy's developer portal.

## Capability map

| Module id | Responsibility | Depends on |
|---|---|---|
| `etsy-connect` | OAuth 2.0 + PKCE for the one shop; token storage and refresh; the typed Etsy HTTP client (auth headers, throttling, errors); reading shop reference data (shipping profiles, return policies, processing profiles, sections, T-shirt taxonomy and its size/color property ids) | — |
| `shop-settings` | The shop's defaults: product template (sizes, colors, price per size, quantity, SKU pattern), listing defaults, description footer, voice notes, banned-terms list | `etsy-connect` |
| `draft-publisher` | Turns one approved item into an Etsy draft. Steps: create the draft, upload images in order with alt text, set the inventory (variations), and record the listing id. It is resumable step by step and idempotent | `etsy-connect`, `shop-settings` |
| `batch-review` | Batch intake (folder upload, grouping by design, local file storage, browser-made previews), the item state machine, the review/edit UI, and the push queue | `shop-settings`, `draft-publisher` |
| `copywriter` | One Claude call per design. Input: mockup previews, voice notes, design name. Output: a typed result with title, description body, tags, materials, alt text per image, suggested colors and transcribed design text | `shop-settings` |
| `listing-guard` | The gate before any push. It runs Etsy field validation (lengths, allowed characters, counts, required fields) and the IP-risk check (banned terms plus a Jev judgment per phrase), and records any overrides | `shop-settings` |

**Build order (riskiest first).** `etsy-connect` → `draft-publisher` → `shop-settings` → `batch-review` → `copywriter` → `listing-guard`.

- **Why this order.** The biggest unknown is whether Etsy accepts our inventory payload for size × color variations. OAuth against a `localhost` callback comes second. Both get settled before any UI or AI work.
- **Verifying the first slices.** `draft-publisher` is first tested with hand-written content from a script.
- **The guard gates every push.** The MVP isn't done until `listing-guard` is in place. Pushing is disabled in the UI until then.

## Etsy API facts this design relies on

Checked 2026-10-01 against the live OpenAPI spec and developers.etsy.com. **(unverified)** marks items taken only from search snippets of Etsy pages that couldn't be fetched.

- **Auth and access**
  - OAuth 2.0 authorization code with mandatory PKCE (S256).
    - Authorize: `https://www.etsy.com/oauth/connect`
    - Token: `POST https://api.etsy.com/v3/public/oauth/token`
  - Access tokens last 1 h; refresh tokens last 90 days.
  - The redirect URI must exactly match one registered on the app. Etsy's Quick Start uses an `http://localhost` callback.
  - Scopes needed: `listings_r listings_w shops_r`.
    - <https://developers.etsy.com/documentation/essentials/authentication>
  - Every request sends `x-api-key: <keystring>:<shared_secret>`. Requests without the secret have been rejected since 2026-02-09.
    - <https://developers.etsy.com/documentation/essentials/requests>
    - <https://github.com/etsy/open-api/discussions/1529>
  - **Rate limits:** 5 QPS and 5K per rolling 24 h, counted per API key. Responses carry `x-limit-per-second`, `x-remaining-this-second`, `x-limit-per-day` and `x-remaining-today`. A 429 carries `retry-after`, an estimate in seconds; back off exponentially.
    - <https://developers.etsy.com/documentation/essentials/rate-limits>
- **createDraftListing** (form-urlencoded)
  - Requires `quantity, title, description, price, who_made, when_made, taxonomy_id`. The listings tutorial also requires `readiness_state_id` for physical listings.
  - `shipping_profile_id`: a forum post says drafts stopped requiring it on 2026-01-29, but the OpenAPI text still says it is required for physical listings. The app always sends it, so the conflict doesn't matter.
  - The T-shirt `taxonomy_id` is looked up at runtime via `getSellerTaxonomyNodes`, never hard-coded.
  - Sending the old `is_personalizable` fields returns an error.
    - <https://developers.etsy.com/documentation/tutorials/listings>
- **Text rules** (enforced by `listing-guard`)
  - **Title:** at most 140 characters (unverified). Allowed: letters, digits, punctuation, math symbols (`\p{Sm}`), spaces, ™©®. `%`, `:`, `&` and `+` may each appear at most once. Copy the regex from the OpenAPI spec; don't rewrite it by hand.
  - **Tags:** at most 13, each at most 20 characters (unverified). Allowed: letters, digits, spaces, `-`, `'`, ™©®.
  - **Materials:** letters, digits and spaces only.
  - **Styles:** at most 2, each at most 45 characters.
- **Images:** `uploadListingImage` is multipart (`image`, `rank`, `overwrite`, `alt_text` up to 500 chars). With `overwrite=true`, an image replaces whatever is already at that rank, which is what makes retries safe. Up to 20 images per listing. The 20 MB file limit is unverified.
- **Variations:** `updateListingInventory` takes JSON products. Each product has `property_values: [{property_id, value_ids, values, scale_id?}]` and `offerings: [{price, quantity, is_enabled, readiness_state_id}]`, plus the `price_on_property` / `quantity_on_property` / `sku_on_property` / `readiness_state_on_property` arrays.
  - **Where ids come from:** size and color property ids, the size `scale_id`, and value ids come from `getPropertiesByTaxonomyId?supports_variations=true`. Shop setup resolves them once and stores them in the shop settings. Deprecated property ids return 400.
  - **Value strings:** values are validated (Etsy rejects some characters, such as parentheses).
  - **Color mapping:** each shop color name maps to an Etsy color value id. A color with no Etsy match is sent as a custom value string.
- **Processing profiles** became the only source of processing time on 2025-09-29.
  - <https://github.com/etsy/open-api/discussions/1472>
- **Settings the API can't reach.** Production partners can't be created via the API, and the seller doesn't need them. The editor's "How it's made" fields can't be set via the API either.
  - <https://github.com/etsy/open-api/discussions/1630>
  - So the app shows a short pre-publish checklist for the seller to finish in Etsy.
- **API Terms**
  - The UI must show: "The term 'Etsy' is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc."
  - No screen-scraping.

## Tech stack

The pinned versions below were current on 2026-10-01. Every package is checked against TS 7 before it is added; see CLAUDE.md. A package that fails `npm run typecheck` with `skipLibCheck: false` is dropped, and the spec is updated.

| Concern | Choice | Why |
|---|---|---|
| Runtime | Node 24 (type stripping), TS 7.0.2 strict | Repo rules |
| Server HTTP | `hono` 4.13.12 + our own adapter (`server/src/http/serve.ts`, about 40 lines on Node's built-in `Request`/`Response`) | Small, typed, no compiler API, runs on Node now and on most hosts later. **`@hono/node-server` was rejected 2026-10-01:** its type definitions (2.x and 1.x) need browser-only types (`MessageEvent<T>`, `BinaryType`, `RequestInfo`) and fail the strict typecheck. Adding `dom` to the server's `lib` was rejected too, because server code could then use browser globals without a type error |
| Validation / AI output schema | `zod` 4.6.5 | One schema validates API input and serves as Claude's structured-output schema |
| Storage | `node:sqlite` (built in) + files under `data/` | No dependency. `data/` is git-ignored |
| Claude | `@anthropic-ai/sdk` 0.131.0, model `claude-opus-5-5`, effort set explicitly (`medium` to start; the model defaults to `medium` too) | Vision + structured outputs. A `refusal` stop reason is handled. The refusal fallback uses the **beta** client: `client.beta.messages.parse` with `betas: ["server-side-fallback-2026-07-01"]` and `fallbacks: "default"`. Exact SDK calls are checked against the claude-api skill at build time |
| Jev | `@typesafe-ai/sdk` 0.6.0 (already installed) | Typed yes/no probabilities for IP risk, unlike free-text Claude output |
| Etsy | Hand-written `fetch` client | There's no official Etsy SDK, and the API surface we need is about 15 endpoints |
| Client | `react` + `react-dom` 19.3.0, `@types/react` + `@types/react-dom` 19.3.0, `vite` 8.3.1, `@vitejs/plugin-react` 6.1.1 | Batch review is a form-heavy, stateful UI. TS is checked by `tsc`, not Vite. **Risk:** Vite's own types haven't been proven under TS 7 with `skipLibCheck: false`. The first client task proves them. If they fail, the fallback is a JS `vite.config.mjs` and no `vite/client` types; if React's types fail, we stop and ask |
| Dev runner | `scripts/dev.mts` (no dependency) | Starts the server and Vite as child processes and kills both on Ctrl+C. Works on Windows, where `&` in npm scripts doesn't |
| Tests | `node:test` (built in) | No dependency, and it runs `.ts` directly |
| Image previews | Browser canvas (no `sharp`) | No native dependency. Claude gets JPEG previews at the largest long edge the current Claude vision docs allow, checked at build time; the cap must keep small printed text readable. Etsy gets the originals |

**Client workspace setup.** `client/package.json` gets:
- a name and `"type": "module"`
- `typecheck`, `build` and `dev` scripts

`client/tsconfig.json` extends `../tsconfig.base.json`, with `lib: [es2025, dom, dom.iterable]`, `jsx: react-jsx`, `module: preserve`, `moduleResolution: bundler` and `noEmit`. `scripts/` gets its own `tsconfig.json` extending the base. Both join `npm run typecheck`.

**Env** (`.env`, template in `.env.example`):

```
TYPESAFE_API_KEY=
ANTHROPIC_API_KEY=
ETSY_KEYSTRING=
ETSY_SHARED_SECRET=
ETSY_REDIRECT_URI=http://localhost:3003/oauth/redirect
```

`ETSY_REDIRECT_URI` must also be registered, character for character, as a callback URL on the Etsy app.

## Commands (to be added)

```
npm install                 # repo root only
npm run dev                 # scripts/dev.mts: server (node --watch) on :3003 + Vite on :5173, proxying /api and /oauth
npm start                   # vite build, then the server serves client/dist on http://localhost:3003
npm test                    # node --test across the server workspace
npm run typecheck           # every workspace + .claude/hooks + scripts
npm run etsy:check          # pings Etsy with the API key, shows the connected shop and token expiry
npm run jev:check           # existing
```

## Project structure

```
server/src/
  index.ts                  # Hono app, binds 127.0.0.1:3003
  db.ts                     # node:sqlite open + migrations
  etsy/                     # etsy-connect: oauth.ts, client.ts, throttle.ts, reference.ts
  settings/                 # shop-settings: settings.ts (zod schema), routes.ts
  publisher/                # draft-publisher: publish.ts, inventory.ts
  batches/                  # batch-review: intake.ts, items.ts, routes.ts
  copywriter/               # copywriter: generate.ts, prompt.ts
  guard/                    # listing-guard: rules.ts, ip-check.ts
  **/*.test.ts              # tests next to the code
client/
  index.html, vite.config.ts, tsconfig.json
  src/                      # React app: pages Connect, Settings, Batch, Review
scripts/
  dev.mts, tsconfig.json    # dev runner
  guard-eval.mts            # live Jev eval over labeled phrases (spends real calls)
data/                       # git-ignored: app.db, uploads/<batch>/<design>/...
```

## Data model (SQLite)

```
shop(id INTEGER PRIMARY KEY CHECK (id = 1),               -- at most one row
     etsy_shop_id, etsy_user_id, name, access_token, refresh_token,
     access_expires_at, refresh_expires_at, scopes, connected_at)
settings(id INTEGER PRIMARY KEY CHECK (id = 1),
         settings_json, updated_at)                        -- zod-validated
batches(id, name, created_at)
items(id, batch_id, design_name, status, content_json, guard_json,
      overrides_json, etsy_listing_id, push_started_at, push_step,
      last_error, updated_at)
images(id, item_id, file_path, preview_path, rank, alt_text, etsy_image_id)
etsy_calls(ts, method, path, status, ms, remaining_today)
      -- every call, read or write; rows older than 30 days are pruned
```

**One shop only.**
- **Reconnecting** (for example, after the refresh token expires) must return the same `etsy_shop_id`. A different shop is refused with a clear message, so batches, settings and property ids made for one shop are never pushed to another.
- **Switching shops** in the MVP means deleting `data/`.

Tokens are never written to logs, `etsy_calls` or error messages.

**Item status flow.** Items move in this order:

```
new → generating → review → approved → pushing → drafted
```

An item goes to `blocked` when the guard fails, and to `failed` when generation or a push fails.

**Pushing without duplicates.** A push runs these steps in order:
1. **Record the start.** Save `push_started_at` *before* calling `createDraftListing`, then save `etsy_listing_id` right after it returns.
2. **Images.** Upload each image with its `rank` and `overwrite=true`, saving `etsy_image_id` after each one.
3. **Inventory.** Call `updateListingInventory`. Its payload replaces the whole inventory, so sending it twice does no harm.
4. **Record progress.** `push_step` names the **last finished** step: `created`, `image:<rank>` or `inventory`. A retry starts at the step after it.

**Retrying after a crash.** If `push_started_at` is set but `etsy_listing_id` isn't, the server died mid-create. On retry the app first lists the shop's drafts (`getListingsByShop?state=draft`) and adopts a draft whose title matches exactly and whose `created_timestamp` is at or after `push_started_at`. It creates a new draft only if none matches.

**Never repeat a create.** Once `etsy_listing_id` is set, no retry calls `createDraftListing` again.

## How the AI parts work

- **copywriter (Claude)**
  - **The call.** One `client.beta.messages.parse` call per design (see Tech stack), with the mockup previews and text in this order:
    - **System prompt:** the voice notes, Etsy's text rules, a ban on brand, celebrity, team and character names and on "inspired by" phrasing, and the banned terms.
    - **User content:** the images followed by the design name.
  - **The output schema is loose on purpose.** It has the right shape, but no length or count limits, so a 21-character tag or a 12-tag answer never fails to parse. The fields:
    - title, description body, tags (array), materials
    - alt text for each image
    - suggested colors
    - `design_text`: the words printed on the shirt, verbatim
  - **Normalize (deterministic, unit-tested), then validate.** Normalization never fails; anything still wrong becomes an editable error in review.
    - **Tags:** trim, strip disallowed characters, drop tags over 20 characters and duplicates, keep the first 13. If fewer than 13 remain, the review screen shows "N tags missing" with a "suggest more" button that asks Claude for N more.
    - **Title:** strip disallowed characters. Never truncate it silently; an over-long title stays as a rule error for the user to fix.
    - **Colors:** keep only colors on the shop's list.
    - **Alt text:** truncate at 500 characters on a word boundary.
  - **Untrusted output.** Claude's output, the folder names and `design_text` are untrusted text. React renders them as text, never as HTML, and they never become file paths or SQL.
  - **Failures:** a `refusal`, an API error or unparsable JSON sets the item to `failed`, and the reason is shown with a "retry" action.
- **listing-guard (rules + Jev)**
  - **What it checks: every piece of text that will be published.** That covers:
    - title, each tag, each material
    - each sentence of the description body
    - each alt text and the `design_text`

    The description footer is checked with the same rules when settings are saved, not per item.
  - **Rule checks** come first, from the text rules above. They are deterministic, never overridable, and unit-tested.
  - **Banned-terms check.** Text is normalized before matching: lowercased, accents and punctuation removed, common character swaps undone (`1→i`, `0→o`, `3→e`, `4/@→a`, `5/$→s`). Then:
    - **Short terms** (under 4 characters) match whole words only.
    - **Longer terms** also match inside words, which catches "Swifties" for "swift".
    - The list is seeded with common risky terms.
    - A match blocks the item.
  - **IP-risk check (Jev):** one `systemOne` call per item. The state holds the item's phrases, and each phrase gets a `noul` question: "Does this phrase name or clearly allude to a trademarked brand or product, a real person, a sports team or league, a band, or a copyrighted character or franchise?"
    - **Size limit:** if the phrases exceed Jev's input limit, they are split across several calls.
    - **Thresholds:** `p ≥ BLOCK` (start at 0.5) → **blocked**; `WARN ≤ p < BLOCK` (start at 0.25) → **warning**. Both live at the top of `guard/ip-check.ts`.
    - **Logging:** every decision is logged with its probabilities, the same pattern as the skill router.
  - **Overrides.** Banned-term and Jev blocks can be overridden, but only with a typed reason.
    - An override is tied to the exact phrase text in that item. Editing the phrase cancels it.
    - Overrides are stored in `overrides_json` with a timestamp.
    - Rule errors and "Jev unreachable" can **never** be overridden. With Jev down, the item stays unpushable until a retry succeeds.
  - **When the guard runs:** on every content change before push, and again at push time against the exact payload being sent.

## Security (threat model)

**What needs protecting**
- The Etsy OAuth tokens, which can edit the shop's listings.
- The Etsy, Anthropic and TypeSafe keys.
- Claude/Jev spend.
- The shop's standing with Etsy.

**Untrusted inputs and their mitigations**

| Input | Threat | Mitigation |
|---|---|---|
| Any web page the seller visits → `localhost:3003` | Cross-site requests and DNS rebinding could trigger generation (spend) or pushes, or connect the wrong account | The server binds `127.0.0.1` only. Every `/api` request must have `Host` equal to `localhost:3003` or `127.0.0.1:3003`, and an `Origin` that is the app's own origin when present; otherwise 403. State-changing routes accept only `POST`/`PUT`/`DELETE` with a JSON or multipart body. No CORS headers are sent |
| OAuth callback | A forged callback or code injection | Random `state` + PKCE verifier per attempt, kept server-side, single use, 10-minute expiry. Callbacks with an unknown or reused `state` are rejected. A callback for a different shop than the stored one is refused |
| Uploaded files | Path traversal, oversized or non-image files | The server generates every stored file name. Browser paths are used only as display labels, after cleanup. Files are capped at 20 MB, accepted only if their first bytes say JPG/PNG, and capped per batch |
| Claude and Jev output; Etsy responses | Injection (LLM05) | Parsed with zod, rendered as text, never interpolated into SQL (parameterized `node:sqlite` statements only) or into paths |
| Mockup images → Claude | Prompt injection via text in the image (LLM01) | The output schema can't trigger actions. The guard and the human review sit between Claude and Etsy. Claude never sees keys or tokens |

**Secrets and responses**
- Keys live in `.env` only. `data/` is git-ignored.
- Error messages sent to the browser are generic; details go to the server log, never tokens.
- Security headers are set on every response: CSP `default-src 'self'` plus `img-src 'self' blob: data:`, `X-Content-Type-Options`, and `X-Frame-Options: DENY`.

## Code style

Same conventions as `.claude/hooks/jev-skill-router.mts`:

- Named exports and small pure functions.
- Tunable constants live at the top of each file.
- Errors are narrowed with `instanceof`.
- No `any`, no `!`, no `enum`.
- `.ts` extensions on relative imports.

```ts
// server/src/guard/ip-check.ts
import { noul, type NoulQuestion, TypeSafeClient } from '@typesafe-ai/sdk';

const BLOCK = 0.5; // probability of yes at which a phrase blocks the push
const WARN = 0.25;

export type PhraseVerdict = { phrase: string; p: number; level: 'ok' | 'warn' | 'block' };

export function classify(p: number): PhraseVerdict['level'] {
  return p >= BLOCK ? 'block' : p >= WARN ? 'warn' : 'ok';
}
```

## Testing strategy

- **Unit tests (`node:test`)** cover all pure logic:
  - text rules
  - the banned-terms matcher
  - the guard classifier and the push-allowed decision
  - PKCE generation, `state` handling, token-expiry math, the same-shop check on reconnect
  - the throttle (4 req/s, honoring `retry-after`)
  - the inventory payload builder (size × color → products with SKUs and prices)
  - tag/title normalization
  - the item state machine and push resumption
  - the Host/Origin guard, and upload name and type checks
- **Etsy client tests:** a fake `fetch` drives the Etsy client against recorded response shapes from the OpenAPI spec. They cover:
  - 401 → refresh → retry
  - **two concurrent requests both hitting an expired token**, which must produce exactly one refresh
  - 429 backoff
  - resuming after a crash in each of these spots: before the listing id was saved, after `image:3`, before inventory
- **Live checks** (manual, spend real calls):
  - `etsy:check`
  - one real draft pushed to the shop and then deleted by hand (Etsy has no sandbox, and drafts are free and invisible)
  - `scripts/guard-eval.mts`: about 25 must-block phrases (brands, celebrities, teams, characters, fan-nicknames like "Swifties", misspellings like "N1ke") and about 25 must-pass phrases, including generic words that are also brands: "Apple Picking Season", "Dove Lover", "Target Practice", "Sunset Tee". It reports misses at the current thresholds. **If the eval fails, report the numbers and ask before changing thresholds.**
  - one Claude run on a sample design
- **UI:** a manual browser pass per slice (Playwright MCP). No component tests in the MVP.
- **Gate:** `npm run typecheck` and `npm test` must pass before any task is called done.

## Boundaries

- **Always**
  - Create drafts only.
  - Run the guard before every push.
  - Keep all keys and tokens server-side.
  - Send all Etsy calls through one throttle (at most 4 req/s), with the rolling-24h count visible in the UI.
  - Log every Etsy call, never its tokens.
  - Allow one token refresh at a time, and save the new refresh token before using it.
  - Pin dependencies exactly and prove they pass TS 7 typecheck.
  - Update this spec when a decision changes.
- **Ask first**
  - Adding a dependency not listed above.
  - Anything that sets `state=active` or deletes or edits an existing Etsy listing.
  - Changing guard thresholds.
  - Changing the DB schema once real data exists.
  - Anything that adds a second shop (see D1).
- **Never**
  - Publish a listing.
  - Push a blocked item without a recorded override.
  - Read, print or commit `.env`; commit `data/`.
  - Send Etsy, Anthropic or TypeSafe keys to the browser.
  - Scrape Etsy pages.
  - Hard-code taxonomy or property ids.

## Success criteria

1. **Connection:** the shop is connected. It still works after the 1 h access token expires, with no re-login, including when a push and a UI read hit the expired token at the same moment. Reconnecting with a different shop is refused.
2. **Intake:** a batch folder of 10 designs × 3–6 mockups becomes 10 items with ordered images and previews.
3. **Generation:** each item gets complete, editable content in under 60 s. Its colors come from the shop's list.
4. **Draft quality:** a pushed draft, read back via the API and checked in Shop Manager, has:
   - title, description (AI body + footer), 13 tags, materials
   - T-shirt taxonomy, `who_made=i_did`, `when_made=made_to_order`
   - processing profile, shipping profile, return policy
   - all images in order with alt text
   - every size × chosen color variation with the right per-size price and SKU
5. **Guard:** every "must block" eval phrase is blocked, and at most 2 of the ~25 "must pass" phrases are blocked; the exact bar is set with you after the first eval run. The guard checks every published text field. Rule violations can't be overridden. Banned-term and Jev blocks need a typed reason, and editing the phrase cancels the override.
6. **Idempotency:** killing the server at each push step (before the listing id is saved, mid-images, before inventory) and retrying gives exactly one draft with each image once.
7. **Local safety:** a request from another origin (simulated with curl and a foreign `Origin`/`Host`) gets 403. An upload named `../x.png` is stored under a server-generated name inside `data/uploads`.
8. **Limits:** no Etsy 429s during a 10-item push, and the daily counter is visible in the UI.
9. **Repo health:** `npm run typecheck` and `npm test` pass with no suppressions. The Etsy trademark notice appears in the UI footer.

## Decisions

### D1: One shop in the MVP (2026-10-01, accepted)

- **Context.** The seller has several apparel shops on separate Etsy accounts. The first draft supported all of them. That raised an unverified question: can one Personal-Access app connect shops owned by different accounts? It also meant per-shop settings and tokens, a rate budget shared across shops, and a picker in every flow.
- **Decision.** The MVP connects exactly one shop. The schema enforces it: single-row `shop` and `settings` tables, and reconnecting must return the same shop.
- **Alternatives considered.** Multi-shop from day one: rejected for now. It adds the access-tier risk and per-shop plumbing before the core flow (mockups → checked draft) is proven.
- **Consequences.**
  - It's simpler to build and test, and there is no access-tier unknown: every tier covers your own shop.
  - **Adding shops later is a planned migration, not a rewrite:**
    - drop the single-row checks and add `shop_id` to `settings`, `batches` and `etsy_calls`
    - add a shop picker
    - split the one rate budget across shops
    - re-check whether one app can connect several accounts (or use one app per account)

### D2: Drafts only (2026-09-30, accepted)

The app never sets a listing active. The seller reviews each draft and publishes it in Etsy. That keeps a human between AI-written text and a live listing, and avoids listing fees on mistakes.

### D3: Seller makes the shirts, no print-on-demand (2026-09-30, accepted)

The app creates listings directly through the Etsy API, with `who_made = i_did` and no production partner. No print-on-demand service syncs listings.

## Future expansion (designed for, not built)

- **More shops.** See D1's consequences for the migration path.
- **Hosting on a live domain.**
  - **Already in place:** the server binds to `127.0.0.1` now, every secret lives server-side, and the server and client are separate workspaces.
  - **Needed before going live:**
    - user auth in front of the app
    - encrypted token storage (or a KMS)
    - an HTTPS callback URL registered with Etsy
    - possibly Etsy Commercial Access
    - a public app name without "Etsy" in it (API Terms; unverified), and Postgres or hosted SQLite
  - **Built in now so the move is cheap:** a `TokenStore` interface around the `shop` table, and a `FileStore` interface around `data/uploads`.

## Open questions

1. **Product template values.** Your sizes, color names and price per size. Also: the default quantity per variation, and whether you want a SKU format.
2. **Description footer.** Do you already have standard size-chart, care and shipping text to paste in?
3. **Mockups.** Is each mockup one shirt color? If so, color detection can map each image to a color variation. Etsy can link photos to variations, but that isn't in the MVP.

### Resolved

- **Callback URL** (2026-10-01): `http://localhost:3003/oauth/redirect` is registered on the "listing-assistant" app.
- **AI disclosure** (2026-10-01): handled by the seller. The pre-publish checklist still reminds them to finish the "How it's made" fields in Etsy, because the API can't set them.
- **Credentials** (2026-10-01): `ETSY_KEYSTRING`, `ETSY_SHARED_SECRET` and `ANTHROPIC_API_KEY` are in `.env`. Slice 1's `etsy:check` will confirm the Etsy pair works.
