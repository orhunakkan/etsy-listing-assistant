# Etsy Listing Assistant

Local-only Node 24 repo with npm workspaces `client` and `server`, built by Claude Code. Install from the repo root only.

## Commands

- `npm run typecheck`: type-checks every workspace and `.claude/hooks`. Run it before finishing any change.
- `npm test`: runs every workspace's `node:test` suite (`*.test.ts` next to the code). Run it before finishing any change.
- `npm start --workspace=server`: starts the server on `http://localhost:3003`, bound to `127.0.0.1` only.
- `npm run jev:check`: makes one real Jev call to confirm the API key and connection work.
- `npm run etsy:check`: makes one real Etsy call (`openapi-ping`) to confirm `ETSY_KEYSTRING` and `ETSY_SHARED_SECRET` work. Logs it to `data/app.db`.

## Work in progress

The approved spec is [SPEC.md](SPEC.md). Work follows [tasks/plan.md](tasks/plan.md), including its Workflow section (one branch per phase, commit per task, stop at checkpoints), and [tasks/todo.md](tasks/todo.md). To resume, continue with the first unchecked task.

## TypeScript 7 (strict), hard requirements

- **TypeScript 7.0.2, pinned exactly.** Never downgrade TypeScript or override peer dependencies to force a package in. Before adding any dependency, confirm it supports TS 7: check its `typescript` peer range, its shipped types, and whether it calls the compiler API (TS 7 has no stable JS compiler API). If it doesn't support TS 7, pick an alternative.
- **Pin every dependency exactly** (`npm install --save-exact`). Tools shared across the repo go at the root; workspace-specific packages go in that workspace.
- **Don't loosen the strict config.** `tsconfig.base.json` holds the shared strict settings, and every TS project extends it: `server/tsconfig.json` and `.claude/hooks/tsconfig.json`. A new TS project must extend it too, and must be added to `npm run typecheck`.
- **Fix type errors; never silence them.** Don't add `any`, `@ts-ignore`, `@ts-expect-error` or non-null `!` just to get a clean check.
- **Dependency types are checked.** `skipLibCheck` is off, so a package with types that don't work under TS 7 fails `npm run typecheck`. Treat that as a reason to reject the package.
- **`noUncheckedIndexedAccess`:** indexed values can be `undefined`, so handle it.
- **`noPropertyAccessFromIndexSignature`:** read environment variables as `process.env['NAME']`.
- **Node runs `.ts` files directly (type stripping), so only erasable syntax is allowed.** `erasableSyntaxOnly` enforces this. No `enum`: use an `as const` object or a union. No `namespace` with runtime code: use modules. No constructor parameter properties, and no `import x = require()` aliases. Upgrading Node won't change this.
- **Relative imports include the `.ts` extension** (`./routes.ts`).
- **Use `.mts` for files outside a `"type": "module"` package.** The root `package.json` isn't an ES module package, so a plain `.ts` file there is treated as CommonJS, and top-level `await` fails.

## Jev skill routing

Jev is TypeSafe's "System One" model. It returns typed answers with probabilities (Choice, Score, Noul), not text.

**Following the routing:**
- **Every prompt goes through Jev first.** A `UserPromptSubmit` hook ([.claude/settings.json](.claude/settings.json) → [.claude/hooks/jev-skill-router.mts](.claude/hooks/jev-skill-router.mts)) asks Jev which agent-skills skills fit the prompt. The answer arrives as a `<jev_skill_routing>` block.
- **Jev's picks are binding.** Load exactly the listed skills with the Skill tool before starting, and follow them. Don't load other agent-skills skills unless the user asks. If the block says no skill fits, load none.
- **If routing is skipped or failed, tell the user.** The hook reports this in its status message. Don't quietly pick skills yourself.
- **Slash commands are not routed.** Prompts starting with `/` already name what to run.

**Tuning:**
- **The settings live at the top of the router script:** `THRESHOLD` (0.5), `MAX_PICKS` (3) and `EXCLUDED_SKILLS`. `using-agent-skills` is excluded because Jev replaces it.
- **Base changes on the log.** Every decision, with all probabilities, is logged to `.claude/jev-routing.log`, which is git-ignored. Check it before changing any setting.

**Calling Jev from code:**
- **SDK:** `@typesafe-ai/sdk` 0.6.0. Read the live docs before writing Jev code, starting at https://docs.typesafe.ai/llms.txt.
- **The API key stays in `.env` as `TYPESAFE_API_KEY`.** `.env` is git-ignored, and `.env.example` is its template.
- **Never read, print or commit `.env`.**
- **Keep the key server-side.** Never set the SDK's `dangerouslyAllowBrowser` option.

## Sources

- Node type stripping: https://nodejs.org/docs/latest/api/typescript.html
- TypeSafe / Jev: https://docs.typesafe.ai/concepts/system-one.md and https://docs.typesafe.ai/models.md
