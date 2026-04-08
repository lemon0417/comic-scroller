---
title: Release
description: Build and deploy flow for the extension and the site.
---

## Extension release

- `comic-scroller-<version>.zip`
- `comic-scroller-<version>.crx`

These files are published on GitHub Releases.

## Site deployment

- `master` branch pushes trigger the Pages deployment workflow.
- The site is built by Astro and deployed through GitHub Actions.
- GitHub Pages should use **GitHub Actions** as its publishing source.

## Commands

- `yarn build` at the repo root builds the extension.
- `yarn site:build` builds the public site.
- The extension's `dist/` output is not reused as the Pages site.
