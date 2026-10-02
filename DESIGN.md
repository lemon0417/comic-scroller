# Design System: Comic Scroller

## 1. Visual Theme & Atmosphere

Comic Scroller is a warm, reader-first product interface built around the idea of a **clear reading desk**. Parchment surfaces make the browser extension feel calm and familiar, while deep ink keeps controls trustworthy and easy to scan. The interface should become visually quiet as soon as the comic pages appear.

- **Density:** Daily App Balanced, 6/10. Popup and library views are compact enough for frequent use without becoming cockpit-dense.
- **Variance:** Predictable Symmetric, 3/10. Repeated reader and library actions stay in familiar positions; asymmetry is reserved for content-led website compositions.
- **Motion:** Static Restrained, 2/10. Motion confirms state changes and loading only; it never competes with reading.
- **Personality:** Clean, intuitive, bright, local, and dependable.
- **Source of truth:** Extension surfaces define the product language. The website may use more whitespace and larger type, but it must retain the same parchment, ink, and single-accent hierarchy.

The physical scene is a manga reader returning to a softly lit reading desk: the comic is the subject, the parchment UI is the desk, and controls remain close at hand without becoming decoration.

## 2. Color Palette & Roles

- **Parchment Canvas** (`#ECE6D6`) — Dominant brand color and primary application background. This is the visual field users should associate with Comic Scroller.
- **Soft Parchment** (`#F8F4E9`) — Loading surfaces, subdued rows, and secondary background layers.
- **Paper Surface** (`#FFFDF7`) — Flat application surfaces, controls, toolbars, dialogs, and popovers.
- **Parchment Hover** (`#FCF8ED`) — Quiet hover state over Paper Surface.
- **Pressed Parchment** (`#EFE8D6`) — Stronger hover or pressed state when a surface change must be obvious.
- **Tab Wash** (`#E0D8C4`) — Retained warm neutral token. Current text tabs use transparent backgrounds rather than a filled navigation rail.
- **Charcoal Ink** (`#131311`) — Primary text, high-emphasis icons, and the darkest brand mark. Never substitute pure black.
- **Shadow Ink** (`#261F17`) — Brand-mark foreground and warm elevation tint.
- **Soft Ink** (`#38342D`) — Secondary headings and standard controls.
- **Muted Umber** (`#746B5C`) — Metadata and supporting text that remains comfortably legible.
- **Parchment Line** (`#CCC2AB`) — One-pixel structural borders and dividers.
- **Reader Blue** (`#1F52B1`) — The single functional accent for primary actions, current selection, follow state, and focus rings. It is not the dominant brand color and must not become a decorative background field.
- **Reader Blue Pressed** (`#143B87`) — Hover and active state within the Reader Blue accent family only.
- **Delete Red** (`#9A362F`) with **Delete Wash** (`#FDEFE9`) — Destructive text, borders, and confirmation surfaces only.
- **Success Wash** (`#EBF6E2`) — Successful completion feedback only; do not use green as a routine accent.
- **Cover Fallback** (`#DCD3BE`) — Missing cover and media placeholder blocks.

Use one warm neutral family throughout; do not mix these parchment and umber values with cool slate grays. Ordinary surfaces stay flat; spacing, fine dividers, and the Parchment Canvas → Soft Parchment → Paper Surface stack establish grouping. Shadows distinguish temporary dialogs and popovers. The brand icon uses parchment, ink, and a Paper Surface separation halo only; Reader Blue stays out of the mark.

## 3. Typography Rules

- **Display:** Avenir Next, `ui-sans-serif`, `system-ui`, sans-serif; 28px, weight 600, 36px line-height, letter-spacing `-0.03em`. Reserve for the manage-page title.
- **Headline:** Avenir Next with the same fallbacks; 18px, weight 600, 24px line-height, letter-spacing `-0.02em`. Use for settings sections, the popup heading, and reader-state headings.
- **Title:** Avenir Next with the same fallbacks; 14px for popup series, 15px for manage series, and 16px for dialogs, weight 600. Series titles use 20px line-height; dialog tracking is `-0.02em`.
- **Body:** Avenir Next with the same fallbacks; 14px, weight 400–500, line-height 1.5–1.7. Keep prose at or below 65 characters per line.
- **Label:** Avenir Next with the same fallbacks; 11–14px, weight 500–700. Use 11px for site labels, 12px for buttons and compact metadata, 13px for section labels and counts, and 14px for text tabs (13px below 640px).
- **Mono:** `ui-monospace`, SFMono-Regular, Consolas, monospace. Use only for code, versions, IDs, or diagnostic values.

Hierarchy comes from weight, ink strength, and spacing rather than oversized type. Software UI uses sans-serif only: no Inter, generic serif, editorial display face, or mono-forward styling. Labels and task-critical text must never rely on low-opacity color to communicate hierarchy.

## 4. Component Stylings

- **Primary buttons:** Reader Blue fill, Paper Surface text, 8px corner radius, 12px semibold label, and `8px 14px` padding. Hover uses Reader Blue Pressed; active feedback translates the button down by 1px. Focus uses a visible 2px Reader Blue ring with a parchment offset.
- **Secondary buttons:** Paper Surface fill, Soft Ink text, 1px Parchment Line border, and Parchment Hover feedback. They share the same height, radius, and typography as primary buttons.
- **Danger buttons:** Delete Wash fill with Delete Red text and border. Copy must state exactly what will be removed and what will remain.
- **Icon buttons:** Familiar line icons inside 36–44px square targets with 8–12px radius. Always provide an accessible label and visible focus state.
- **Ordinary surfaces:** Lists, settings sections, popup content, and reader chrome remain flat, without enclosing rounded cards or shadows. Use spacing and 1px Parchment Line dividers to group content.
- **Dialogs and popovers:** Paper Surface fill, 12px dialog radius, and 8px popover radius. Their warm shadow is `0 12px 36px rgba(38, 31, 23, 0.14)`. The smaller `0 2px 6px rgba(38, 31, 23, 0.12)` shadow is used for the switch thumb, not ordinary content surfaces.
- **Series rows:** Flat rows with 16px vertical padding, a 40px square cover in popup or 48px in manage, and 6px cover radius. Site label, two-line-clamped title and status, and grouped actions form the row; a bottom divider and quiet hover wash provide separation and feedback.
- **Tabs:** Transparent text tabs sit on a 1px divider, with a 48px height. The current tab uses a 2px Reader Blue underline, stronger ink, semibold text, and selected semantics. Tab counts remain plain tabular text rather than pills.
- **Reader pages:** Centered, unframed images form one continuous rail with zero gap between rows. Page surfaces have no border, corner radius, shadow, or added padding.
- **Inputs:** Label above, optional helper text below, error below the field. Paper Surface fill, 1px Parchment Line border, 8–12px radius, and Reader Blue focus ring. Never use floating labels.
- **Loading:** Skeletons match the exact cover, row, or content dimensions. A looping spinner is permitted only for a compact isolated action, never as decorative ambient motion.
- **Empty states:** Explain what belongs in the space and provide the single most useful next action. Do not stop at “No data.”
- **Errors:** Keep errors inline when recovery is local; show a clearly labeled retry action and preserve already loaded reading content.
- **Brand mark:** A vertical parchment manga volume on a transparent canvas, with an ink outline, spine, and cover panel. An ink downward arrow overlaps the lower-right cover in the foreground; a Paper Surface halo separates the layers. The volume must fill the available toolbar frame and remain recognizable at 16px.

Every interactive component defines default, hover, focus, active, disabled, loading, and error behavior where applicable. Use the same component vocabulary in reader, popup, and manage views.

## 5. Layout Principles

- Reader content owns the visual hierarchy. At 640px and above, navigation occupies one 48px toolbar row; below 640px, title and actions occupy two rows totaling 96px. The shared `getReaderHeaderHeight` geometry in `src/domain/utils/readerLayout.ts` keeps the toolbar, canvas offset, image sizing, and scrolling aligned; the zoom popover sits 8px below the toolbar.
- Comic pages stay centered in a continuous rail, at most 1120px wide at the default scale, with zero vertical image gap. The canvas begins directly below the toolbar; no decorative page frame interrupts the reading flow.
- Popup and manage views use one primary reading path: resume or inspect updates first, then manage secondary data.
- Manage uses a flat full-height shell, at most 1184px wide, with 32px side padding reduced to 16px below 640px. The title and text tabs remain above notices, search, and an independently scrolling virtual list. Settings use plain sections separated by dividers in a column at most 800px wide.
- Popup uses a direct header with title and manage action above scrolling sections and divider-separated rows. The total update count sits immediately after the latest-updates section title with an 8px gap, before the divider. The extension popup ranges from 500–680px wide and 440–700px high; it has no inset outer card. Content side padding is 20px, reduced to 16px below 640px.
- Below 640px, manage row actions move under their text and shared action targets reach 44px. Popup rows retain horizontal actions down to 400px, then place actions under the text. Titles and metadata wrap or clamp within the available width.
- Use Flexbox for toolbars and control groups, and CSS Grid for cover/copy/action rows and two-dimensional arrangements. Do not simulate grids with percentage calculations.
- Contain long-form website content with a readable max-width. Product lists may run wider when their data requires it.
- Keep elements in separate spatial zones. Menus, dialogs, and popovers must not overlap or clip task-critical content unexpectedly.
- Avoid equal three-card marketing rows. Prefer a single focused panel, an asymmetric two-column composition, or a dense list according to the content.
- Below 768px, multi-column website layouts collapse to one column, touch targets reach at least 44px, and horizontal overflow is forbidden.
- Use `min-height: 100dvh` for full-viewport web surfaces. Do not use fixed `100vh` when mobile browser chrome can resize the viewport.
- The documentation website may use a left-aligned content-led hero with one primary action. The extension itself never uses hero layouts.

## 6. Motion & Interaction

- Standard state transitions last 150–220ms and use an ease-out-quart or ease-out-quint curve. Never use linear, bounce, or elastic easing.
- Animate only `transform`, `opacity`, or a restrained color transition. Do not animate layout dimensions or positions such as `top`, `left`, `width`, or `height`.
- Active feedback may translate a button by 1px. Dialogs may use a short opacity and scale entrance when it improves orientation.
- Loading indicators may loop while work is actually pending. Idle controls, navigation, cards, and brand elements never pulse, float, shimmer, or type indefinitely.
- Lists render immediately. Do not delay reading data with waterfall reveals or decorative page-load choreography.
- Preserve scroll position and reading continuity across updates. Motion must never move the comic away from the reader’s current place.
- Every animation has a `prefers-reduced-motion: reduce` alternative using an instant state change or short crossfade.

## 7. Anti-Patterns (Banned)

- No pure black, cool slate palette, purple/neon accent, gradient text, outer glow, or decorative glassmorphism.
- No blue-dominant brand surfaces. Reader Blue is a functional state color only.
- No Inter, generic serif, decorative display font, or custom cursor.
- No overlapping text and imagery, clipped controls, or absolute-positioned decoration that competes with comic pages.
- No identical three-column card grid, nested cards, hero metrics, numbered section scaffolding, or repeated uppercase eyebrows.
- No decorative perpetual motion, bouncing chevrons, “Scroll to explore,” “Swipe down,” or staggered list reveals.
- No emojis as interface icons, generic placeholder identities, fake round statistics, broken stock-image links, or AI copywriting clichés such as “Elevate,” “Seamless,” “Unleash,” and “Next-Gen.”
- No unexplained destructive action, inaccessible icon-only control, invisible focus state, or required text below WCAG AA contrast.
- No visual embellishment that competes with manga pages or makes local data actions feel unpredictable.
