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

- `client/index.html` is the static placeholder page.
- `server/src/index.js` is a dependency-free Node HTTP server. It serves the page and exposes `/health` and `/ready`. `npm run build` copies it to `server/dist/`, which is the entry point Azure App Service starts.

## Deployment

Every push to `main` runs the CI quality gates (format check, build, smoke test, `npm audit`) and then ZIP-deploys to Azure App Service. The deploy job needs the `AZURE_WEBAPP_NAME` and `AZURE_WEBAPP_PUBLISH_PROFILE` repository secrets.
