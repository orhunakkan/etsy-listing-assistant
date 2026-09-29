# Stagecraft Labs

Source for [stagecraftlabs.com](https://stagecraftlabs.com). The site currently serves a placeholder page while the next app is built.

## Requirements

- Node 24 (see `.nvmrc`)
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

- `client/public/` is what gets deployed: the placeholder page plus `staticwebapp.config.json` (security headers and 404 handling).
- `server/src/index.js` is a dependency-free Node HTTP server for local development. It serves the same page with the same headers and exposes `/health` and `/ready`.

## Deployment

The site is hosted on Azure Static Web Apps (Free plan). Every push to `main` runs the CI quality gates (format check, build, smoke test, `npm audit`) and then uploads `client/public/` to the Static Web App. The deploy job needs the `AZURE_STATIC_WEB_APPS_API_TOKEN` repository secret.
