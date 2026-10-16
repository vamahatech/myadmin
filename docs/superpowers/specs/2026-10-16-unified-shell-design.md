# Unified Shell Design (refined top bar + sidebar)

## Problem

Inside an app, the console read as separate pieces rather than one product:

- The platform mark and the Vamaha app both used `vamaha.svg`, so the header
  showed the same logo twice (`[V] Vamaha Tech / [V] Vamaha`), blurring
  "platform" vs "app".
- Header, sidebar and content all used `bg-bg`, split only by 1px borders —
  three loose strips with nothing grouping them.
- The sidebar started straight with nav items; the app it belonged to was
  named only in a small header dropdown.
- App switching (the superadmin's main job) was a low-weight dropdown.
- `AppTile.accentColor` was defined but never used, so switching apps
  changed almost nothing visually.
- List pages (e.g. Articles) floated on the canvas: no breadcrumb, no
  counts, no toolbar attached to the list.

## Decision

Keep the top bar + sidebar structure (an app rail and a tabs-only layout were
considered; the rail was a bigger change, tabs don't scale to Verdiq's 13
modules), and fix the hierarchy: **platform → app → module → page**.

## Shell

- **One frame.** `global-header` and `app-sidebar` share `bg-surface` with no
  border between them, forming an L-shape. `<main class="shell-content">` is
  the `bg-bg` canvas, inset with `border-t` and, at md+, `border-l` +
  `rounded-tl-2xl`. Still edge to edge — no max-width.
- **Platform mark.** The header uses the full wordmark
  `public/vamaha-wordmark.png` / `vamaha-wordmark-dark.png`, generated from
  `public/vVamahaS.png` (cropped to the artwork, 144px tall; the dark variant
  recolours the navy text to the dark-theme text colour). `.wordmark-light`
  / `.wordmark-dark` in `styles.css` swap them on `html.dark`. Inside an app
  below 640px the image is clipped to just the V to leave room for the
  switcher. The square app icon is never used as the platform mark.
- **App switcher.** A bordered pill after a `chevron-right`: app icon with an
  accent-coloured dot, name, `chevrons-up-down`. The panel lists each app
  with icon, accent dot, name and tagline, plus "All applications".
- **Sidebar.** Starts with an app header (40px icon, name, 2-line tagline),
  then a "Modules" label and the nav. The active item is raised (`bg-card`,
  `ring-border`) with its marker and icon in `--app-accent`. The mobile
  drawer reuses the same header.
- **App accent.** `AppShellComponent` sets `--app-accent` on its root from
  `AppTile.accentColor` (fallback `--color-primary`).
- **Account menu.** Same behaviour; avatar is `bg-card` with a border ring so
  it sits on the surface header.

## Page pattern (reference: Vamaha Articles)

`pages/apps/vamaha/admin-dashboard`:

- `app-page-header` gained an optional `breadcrumb` input
  (`Crumb { label; link? }[]`), rendered above the title.
- Stat strip: `.stat` tiles (Total, Published, Drafts + in-review hint,
  Last updated) computed from the loaded list — no new API.
- List card with an attached toolbar: `.seg` status filter (All / Published /
  Drafts / In review with counts, `aria-pressed` buttons) and a search input
  (title/slug, client-side). Then a column header row (sm+) and grid rows
  that are each one link; below 640px rows stack and the date moves next to
  the slug. "No articles match" state with Clear filters.

New shared pieces: `.stat` (+ `__label/__value/__hint`), `.seg`
(+ `.seg__count`), icons `chevron-right`, `chevrons-up-down`, `search`.

## Testing

- `ng build` (templates) — passes with only the 2 known Verdiq NG8107
  warnings.
- Playwright with mocked `**/api/auth/me` and `**/content/articles/admin/all`:
  screenshots at 1440 / 1280 / 1024 / 390, light and dark, for `/`,
  `/apps/vamaha`, `/apps/vamaha/articles/new`, `/apps/verdiq/overview`,
  `/apps/emi-planner/analytics`; switcher panel open; mobile drawer open.

## Out of scope / follow-ups

- Applying the list pattern to Push, EMI Planner and Verdiq pages; moving
  Verdiq's local `.tab` filters to `.seg`.
- A ⌘K command palette in the top bar.
- On phones inside the Vamaha app the brand V and the Vamaha app icon (also a
  V) sit side by side.
