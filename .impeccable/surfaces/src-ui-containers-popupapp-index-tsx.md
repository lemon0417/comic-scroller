---
version: 1
slug: "src-ui-containers-popupapp-index-tsx"
primary_target: "src/ui/containers/PopupApp/index.tsx"
related_targets: ["popup.html"]
---

# Popup — resume and updates

Mode: Operate. A reader opens the extension popup to resume the last work or start an updated chapter; library management is the secondary exit.

Use a direct header with update count and the manage action, followed by one scrolling content region. Resume and update sections use headings, fine dividers, and flat cover/copy/action rows rather than panels inside panels. Release notices live in the scrolling content so the header remains available.

The signature is an immediately actionable feed with no enclosing visual card. Keep the existing popup dimensions, data limits, cover fallbacks, loading/empty/error states, and reader-opening behavior. In constrained widths, place actions below the copy.

Decision: user-selected `flat-popup-20261002`, verified as an actual Chrome extension popup using isolated synthetic data. No unresolved layout decisions.
