---
version: 1
slug: "src-ui-containers-manageapp-index-tsx"
primary_target: "src/ui/containers/ManageApp/index.tsx"
related_targets: ["manage.html", "src/ui/containers/ManageApp/ManageFeedList.tsx", "src/ui/containers/ManageApp/ManageDataPanel.tsx"]
---

# Library — flat task workspace

Mode: Operate. Readers return here to open updates, resume followed works, inspect history, or manage their local library.

The title and top text tabs establish location. Notices precede the current task; search and results share one list region. Cover, title, reading status, and actions sit directly in divider-separated rows. On narrow windows, actions move below the copy instead of compressing titles. Options are flat sections ordered by sync, data transfer, developer controls, and reset.

The signature is a library without an enclosing card stack: grouping comes from proximity, headings, and rules. Only dialogs elevate. Retain wrappers required by virtualization, measurement, scrolling, and accessible semantics, not decorative wrappers.

Constraints: retain feed semantics, keyboard tabs, confirmation dialogs, local persistence, existing palette/icons, and UI → reducers → epics → store. Long lists must remain virtualized and scroll to the final row even with notices visible. The documentation website is out of scope.

Decision: user-selected `flat-library-20261002`, implemented and checked at desktop, 390px, and 320px widths. No unresolved layout decisions.
