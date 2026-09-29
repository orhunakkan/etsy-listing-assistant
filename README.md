# Stagecraft Labs

Local-only for now: a placeholder page while the next app is built. Nothing is deployed.

## Requirements

- Node 24 (see `.nvmrc`)
- TypeScript 7 (currently 7.0.2). Don't add dependencies that conflict with TS 7 or don't support it.
- npm workspaces: `client` and `server`. Install from the repo root only.

## Commands

| Task                  | Command                                   |
| --------------------- | ----------------------------------------- |
| Install               | `npm install`                             |
| Dev server (:3001)    | `npm run dev`                             |
| Build                 | `npm run build`                           |
| Run the built server  | `npm start`                               |
| Format / format check | `npm run format` · `npm run format:check` |

## Layout

- `client/public/index.html` is the placeholder page.
- `server/src/index.js` is a dependency-free Node HTTP server. It serves the page with security headers and exposes `/health` and `/ready`.

## CI

Every push and pull request to `main` runs the quality gates: format check, build, smoke test and `npm audit`. CI deploys nothing.
