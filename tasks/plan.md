# Implementation plan: Etsy Listing Assistant (MVP)

Source of truth: [SPEC.md](../SPEC.md) (approved 2026-10-01). The task checklist lives in [todo.md](todo.md).

Status: **approved 2026-10-01**.

## Workflow (agreed with the user, 2026-10-01)

- **One branch per phase,** cut from `main`: `feature/phase-0-foundation`, `feature/phase-1-etsy-connect`, and so on.
- **Commit after each verified task** (`npm run typecheck` + `npm test` + the task's own check). Tick its box in [todo.md](todo.md) in the same commit. Messages follow `<type>: <description>` and end with the Co-Authored-By line.
- **Stop at every CHECKPOINT** and report to the user. Only after they approve, fast-forward `main` to the phase branch (`git merge --ff-only`) and cut the next phase branch.
- **Never** push, force-push or rewrite history without asking.
- **Resuming in a new session:** read SPEC.md, this plan and todo.md. Check `git status` and the current branch. Continue with the first unchecked task.

## Approach

- **Riskiest first.** We follow the spec's build order: `etsy-connect` → `draft-publisher` → `shop-settings` → `batch-review` → `copywriter` → `listing-guard`. The biggest unknown is whether Etsy accepts our size × color inventory payload. A real draft settles that at **Checkpoint C**, before any UI or AI work.
- **Thin, verified slices.** Each task changes at most about 5 files and leaves the repo green: `npm run typecheck` and `npm test` pass.
- **Pure logic first, with tests.** Rules, normalization, inventory building, the throttle and the state machine are pure functions with `node:test` tests. Code that touches the network is tested against a fake `fetch` or a fake Jev/Claude client.
- **Live checks.** Real Etsy, Claude and Jev calls happen only in named live-check steps.
- **Dependencies arrive when first needed.** Each is pinned exactly, and the task that adds it must pass `npm run typecheck` with `skipLibCheck: false`. If a package fails, we stop and update the spec instead of working around it.
- **Docs stay current.** Any task that adds an npm script also updates CLAUDE.md's Commands section in the same change.

## Phases and checkpoints

| Phase | Tasks | Ends with |
|---|---|---|
| 0. Foundation | T1–T3 | **Checkpoint A:** `npm run etsy:check` gets a 200 from Etsy with your `keystring:shared_secret` |
| 1. etsy-connect | T4–T6 | **Checkpoint B:** your shop is connected through the browser. The token refresh works. The T-shirt taxonomy and size/color property ids are printed |
| 2. draft-publisher | T7–T9 | **Checkpoint C:** a hand-written sample draft (2 images, 2 sizes × 2 colors, placeholder prices) appears in Shop Manager. **You confirm it and delete it** |
| 3. shop-settings + client shell | T10–T14 | **Checkpoint D:** the app runs at `localhost:3003`. You fill in Settings with your real product details. **Needs your product details** |
| 4. batch-review | T15–T18 | **Checkpoint E:** a real folder becomes items you can review and edit. Pushing is still disabled |
| 5. copywriter | T19–T21 | **Checkpoint F:** Claude fills a real batch. You judge the output quality on 3 designs |
| 6. listing-guard | T22–T25 | **Checkpoint G:** guard eval numbers are reported to you, then pushing is enabled |
| 7. Acceptance | T26 | **Checkpoint H:** every spec success criterion is checked on a 10-design batch, and the README is written |

At each checkpoint the agent stops and reports. Work continues only after you confirm.

## Key design notes per phase

### Phase 0
- The Hono app binds to `127.0.0.1:3003`. The local-only middleware (Host/Origin check, security headers) arrives in T1, before any route that does something.
- `db.ts` creates the full spec schema up front. It is a single migration file versioned with `PRAGMA user_version`, so later schema changes are additive.
- The Etsy client:
  - is a single `etsyFetch(path, init)` that adds `x-api-key`, and the bearer token when needed
  - sends every call through the throttle and logs it to `etsy_calls`
  - returns a typed `EtsyError`
  - takes `fetch` as a parameter so tests can supply a fake

### Phase 1
- **OAuth state** (`state`, PKCE verifier, expiry) is kept in memory. It is single-use, so a server restart only cancels a sign-in that is in progress.
- **Token refresh** is single-flight: one in-progress refresh promise per process, and the new tokens are saved before the promise resolves. A 401 triggers one refresh and one retry.
- **Reference data** has no UI in this phase. A script prints it, so Checkpoint B can verify the T-shirt taxonomy and the property and scale ids against your real shop.

### Phase 2
- The inventory builder is a pure function: `(sizes, colors, prices, qty, skuPattern, readinessStateId, propertyIds) → payload`.
- `publish.ts` implements the spec's push algorithm exactly, with the order of DB writes as listed there. Tests kill the push at each step by making the fake `fetch` throw, then retry.
- T9 is a one-off script (`scripts/publish-sample.mts`) that bypasses the guard. It uses fixed, harmless text such as "Sample Listing Test Draft". That is the only push that skips the guard, and it never makes an active listing.

### Phase 3
- **Text rules come first.** `guard/rules.ts` (the Etsy text rules) is built here rather than in phase 6, because settings validation (color value strings, footer text) needs it.
- **TS 7 risk.** The client scaffold (T12) is where the Vite/React types risk is proven. If it fails, we apply the spec's fallback, or stop and ask.

### Phase 4
- **Client-side work:** the browser groups files by subfolder and makes previews with a canvas.
- **Server-side checks:** the server re-checks everything: magic bytes, size caps, its own file names, natural sort order. It never trusts the client's grouping beyond display labels.
- **Pushing stays off:** the Push button is visible but disabled, labelled "Guard not built yet".

### Phase 5
- **Concurrency:** at most 2 Claude calls run at a time.
- **Cost check:** each run logs the token usage of each call, so per-listing cost can be checked at Checkpoint F.
- **Quality bar:** prompt wording is tuned only against your feedback at Checkpoint F.

### Phase 6
- **Jev client is injectable:** it is passed in as a parameter, so tests run without calls.
- **Live eval:** `scripts/guard-eval.mts` runs live once, and the numbers go to you.
- **Thresholds:** they are not changed without asking.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Etsy rejects the inventory payload (property/scale ids, color values) | Variations can't be created, which blocks the MVP | Settled at Checkpoint C with a real draft, before any UI work. The fallback is Etsy's custom-variation property ids (513/514) for color |
| Vite or React types fail under TS 7 with `skipLibCheck: false` | No client build | Proven in T12. Fallback: a JS `vite.config.mjs` and no `vite/client` types. If React's types fail, we stop and ask |
| `@anthropic-ai/sdk` types fail under TS 7 | Copywriter is blocked | Installed in T20 and checked right away. Fallback: raw `fetch` against the HTTP API, behind the same function signature |
| ~~`hono` types fail~~ **Happened in T1:** `@hono/node-server` failed; `hono` passed | — | Resolved with the user: keep `hono`, serve it with our own adapter (`server/src/http/serve.ts`). See the SPEC Tech stack row |
| `createDraftListing` field rules differ from the spec (e.g. `shipping_profile_id`, `readiness_state_id`) | Pushes fail | T9 shows the real 400 messages. The spec's facts section is updated with what Etsy actually returns |
| Jev over-blocks generic words ("Apple", "Target") | You have to override often | The eval at Checkpoint G includes such phrases. Threshold changes are your call |
| Claude previews too small to read printed text | Weak IP check on `design_text` | The preview size is set from the current Claude vision docs. `design_text` is verified on real mockups at Checkpoint F |

## What needs you, and when

| When | What |
|---|---|
| Checkpoint B | Approve Etsy's consent screen in your browser |
| Checkpoint C | Look at the sample draft in Shop Manager, then delete it |
| **Before Checkpoint E** (deferred from Checkpoint D on 2026-10-02) | **Product details:** sizes, colors, price per size, default quantity, SKU format, packed weight and dimensions. Plus your description footer and the answer to the mockup-colors question |
| Checkpoint F | Judge generated listings for 3 real designs |
| Checkpoint G | Accept or adjust the guard thresholds based on the eval |
| Checkpoint H | Final acceptance |
