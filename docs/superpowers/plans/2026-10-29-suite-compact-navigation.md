# Compact suite navigation redesign

**Goal:** Redesign Office, Documents, Change Tracker, Health Dashboard and admin/account pages using the supplied navy/white menu reference and a left-menu/right-content composition.

**Design Read:** Redesign for daily office-tool users, with a compact, calm navy-and-light-card language. DESIGN_VARIANCE 3 / MOTION_INTENSITY 2 / VISUAL_DENSITY 6. Native CSS Modules and installed Phosphor icons; no new design-system, animation or image dependencies. The reference supplies visual direction, not new AI generators, credit balances or saved-document features.

**Accepted scope:** User selected Office and four new applications including admin pages. `/menu`, portfolio and FinTrack are outside scope. Existing routes, API behavior, role separation and public Documents PIN access are preserved. No browser tests, following the user's standing instruction.

## Existing-state audit

- Shared shell puts toolbar, workspace control, large title and four Office tabs above the task. Repeated vertical chrome consumes content space.
- Documents public/editor have a different shell from Documents admin; theme selection and navigation are duplicated.
- Tools CSS retains layered light-only declarations plus overrides, while the desired contract is one consistent light/dark token system.
- Functional owners already expose real feature components by route. Sidebar links can render those route components in the right pane; no iframe or replacement mock UI is needed.
- Preserve session refresh without unmounting drafts, four Office domains, private workspace keys, version-aware generation and role-gated admin links.

## Target composition

Desktop: 252px left menu, compact navy welcome/brand block, grouped white menu panels, and full remaining width for the active route. Main content has a compact account/theme row, short heading and existing component. Small control radius 8-10px, group radius 14px, brand radius 16px. Light canvas cool off-white, navy primary text/accent; muted gold only in the brand block, as supplied by the reference. Dark mode uses the same hierarchy with dark surfaces and readable blue accents.

Below 960px: one composition, a Menu button before the same sidebar in DOM order, disclosure in normal document flow, then active content. No duplicate navigation, overlay/focus trap or hidden form content. Escape closes the menu and restores its button focus; selecting a route closes it. Forms reflow at their content breakpoint; desktop list/detail goes to one column when the side menu leaves insufficient width.

## Tasks

- [x] Add regression checks for grouped navigation, route selection, admin visibility, mobile disclosure and retained content during session refresh.
- [x] Add shared `SuiteFrame` with sidebar/menu and integrate `ToolsShell` while preserving auth/workspace behavior.
- [x] Move public Documents/catalog/editor into the frame; keep PIN and editor logic intact. Adapt tests to the presentation wrapper.
- [x] Calibrate theme/shared/Office/Documents CSS for navy reference, compact spacing and responsive panes. Token text contrast minimum 5.35:1.
- [x] Run focused UI behavior checks, role/theme/Documents/Office regressions, lint, TypeScript and Webpack production build. Recorded pre-flight and limits in the 30 October implementation record; no browser/Lighthouse claims.

## Verification boundaries

This is a product interface. Apply design-taste-frontend's redesign/palette/spacing/copy checks where relevant; marketing hero, photo, testimonial and logo-wall rules do not apply. Reference imagery is not a new asset to embed in the product. No measured Core Web Vitals or rendered/mobile interaction claims without browser testing. Keep all unrelated dirty-worktree changes.
