---
version: 1
slug: "src-ui-containers-app-index-tsx"
primary_target: "src/ui/containers/App/index.tsx"
related_targets: ["app.html", "src/ui/containers/ImageContainer/index.tsx", "src/domain/utils/readerLayout.ts"]
---

# Reader — uninterrupted image rail

Mode: Experience. Comic artwork leads; controls help readers choose chapters, adjust scale, follow the work, and enter fullscreen without disrupting their place.

Center an uninterrupted vertical image rail below the toolbar. Remove decorative page borders, corner rounding, shadows, and inter-page gaps. Keep image rows and scroll wrappers needed by virtualization and reading-position restoration.

The toolbar is one row on regular windows and two rows below 640px: chapter context first, reading actions second. Its rendered height and the virtual canvas offset use the same geometry helper. Zoom controls remain a secondary popover; chapter navigation remains a keyboard-accessible dialog.

The signature is adjacent comic images meeting at a zero-gap seam. Loading, retry, paywall, and chapter-end states use the same quiet surface language without creating framed page cards.

Constraints: retain image scaling, bounded memory, chapter loading/preloading, visible-range tracking, and eviction anchor restoration. Preserve the existing palette/icons and data flow. No supported-site, permission, backend, or persistence changes.

Decision: user-selected `flat-reader-20261002`, verified at desktop, 640px, 390px, and 320px widths. No unresolved layout decisions.
