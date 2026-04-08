# Comic Scroller

[![CI](https://github.com/lemon0417/comic-scroller/actions/workflows/ci.yml/badge.svg)](https://github.com/lemon0417/comic-scroller/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/lemon0417/comic-scroller)](https://github.com/lemon0417/comic-scroller/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/lemon0417/comic-scroller)

Comic Scroller is a Chrome Extension (Manifest V3) that provides a cleaner manga reading experience across supported sites.

It opens chapters in a dedicated reader page, loads chapter images into a continuous reading flow, keeps reading history, tracks subscriptions, and checks for updates through the built-in library.

## Fork Notice

This repository is a maintained fork of the original open-source project:

- Original project: [zeroshine/ComicsScroller](https://github.com/zeroshine/ComicsScroller)
- Original author: [zeroshine](https://github.com/zeroshine)

This fork preserves attribution to the original project and continues to use the MIT license.
It is maintained under the repository name `comic-scroller`, while the original project was published as `ComicsScroller`.

## Current Features

- Custom reader page for supported manga sites
- Continuous chapter reading flow
- Library management for history, subscriptions, and updates
- Background update checks and notifications
- Popup and manage pages for quick access and full library control
- IndexedDB-based persistence with import/export support
- Release packaging for both `zip` and signed `crx` artifacts

## Supported Sites

- DM5 / 動漫屋
- SFACG
- ComicBus / 無限動漫

## Installation for Users

For general users, the recommended installation path is loading the unpacked extension in Chrome developer mode.

### Install from a Release Build

1. Download the latest release asset.
2. Extract the archive so you can access the built extension files.
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the extracted `dist/` directory.

### Notes

- The unpacked `dist/` build is the most reliable manual installation path.
- Signed `crx` artifacts are included in releases, but they are mainly useful for managed deployment or Linux self-hosted update flows.
- After installation, open a supported chapter page and Comic Scroller will redirect it into the reader page.

## Project Structure

- `src/app.tsx`: reader entry
- `src/popup.tsx`: popup entry
- `src/manage.tsx`: manage page entry
- `src/background.ts`: MV3 service worker entry
- `site/`: Astro + Starlight GitHub Pages site
- `src/ui/`: UI components and containers
- `src/domain/`: actions, reducers, selectors, stores
- `src/epics/`: side effects and async flows
- `src/sites/`: site adapters and parsing logic
- `src/infra/`: persistence, background services, and browser I/O
- `docs/`: current project documentation

Start with [docs/index.md](docs/index.md) for the maintained documentation set.

## Development

This project is Yarn-first and uses Vite, React, Redux Toolkit, and Redux Observable.

### Install

```bash
yarn install
```

### Development Build

```bash
yarn start
```

This writes watch builds into `dist/`. Load `dist/` from `chrome://extensions` during development.

### Production Build

```bash
yarn build
```

### Website Dev

```bash
yarn site:dev
```

### Website Build

```bash
yarn site:build
```

### Quality Checks

```bash
yarn typecheck
yarn lint
yarn test
```

## Release

### Bump Version

```bash
yarn version:bump <major|minor|patch|x.y.z>
```

### Build Release Artifacts

```bash
yarn release
```

This runs:

- version verification
- lint
- tests
- production build
- `zip` packaging
- signed `crx` packaging

### CRX Signing

Signed CRX builds require:

- `CHROME_EXTENSION_PRIVATE_KEY_B64`

The release build also injects the corresponding manifest `key` into the built extension so release builds can keep a stable extension ID.

### Important Note About CRX Distribution

Signed CRX artifacts are useful for:

- release artifacts
- managed deployment
- Linux self-hosted update flows
- keeping a stable extension identity across signed and unpacked release builds

For general manual installation, loading the unpacked `dist/` build in developer mode remains the most reliable path.

## Documentation

Key docs:

- [Project Overview](docs/01-overview/README.md)
- [Architecture](docs/01-overview/architecture.md)
- [Extension Rules](docs/01-overview/extension-rules.md)
- [Commands](docs/02-dev/commands.md)
- [Site and Pages](docs/02-dev/site.md)
- [Release Guide](docs/02-dev/release.md)
- [Library Data Model](docs/03-features/library.md)
- [DM5 Parsing Flow](docs/04-sites/dm5.md)

## Contributing

Issues and pull requests are welcome.

Before opening a PR:

- use Yarn for all project commands
- run `yarn typecheck`
- run `yarn lint`
- run `yarn test`
- follow Conventional Commits for commit messages

See [docs/index.md](docs/index.md) for the maintained development and release documentation.

## License

This project is licensed under the [MIT License](LICENSE).

This fork remains MIT-licensed and retains attribution to the original ComicsScroller project and its author.
