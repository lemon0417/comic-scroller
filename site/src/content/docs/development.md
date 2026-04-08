---
title: Development
description: Repo layout and local commands.
---

## Workspace

- the browser extension at the repository root
- the GitHub Pages site in `site/`

## Extension commands

- `yarn start`
- `yarn build`
- `yarn lint`
- `yarn test`
- `yarn typecheck`

## Site commands

- `yarn site:dev`
- `yarn site:build`
- `yarn site:preview`
- `yarn site:check`

## Architecture constraints

- No backend services.
- Preserve the existing data flow: UI -> reducers -> epics -> store.
- Do not edit `dist/` by hand.
- Use Yarn for all project commands.
