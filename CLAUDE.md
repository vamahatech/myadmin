# Vamaha Studio Console (myadmin) — Claude Code Context

Superadmin console for every Vamaha app. One Angular frontend; each app is a
route subtree rendered inside one shared shell. Read this before UI work —
the design system below is already built; reuse it, don't re-invent it.

**Monitoring features (overview, users, activity, analytics, errors, feedback, audit) follow
[docs/standards/monitoring-standard.md](docs/standards/monitoring-standard.md)** (metric
definitions, admin API contract, data/privacy rules, per-app status) and
[docs/standards/development-rules.md](docs/standards/development-rules.md) (build order, page
structure, backend rules, definition of done). Read both before building any of them.

## Stack & commands
- Angular 21 standalone components, signals, `@if/@for` control flow
- Tailwind CSS v3.4 + plain CSS component layer; fonts Manrope (UI) / Fraunces (opt-in)
- `npx ng serve --port 4210` · `npx ng build` (runs `prebuild` → scripts/inject-verdiq-env.js)
- Type check: `npx tsc --noEmit -p tsconfig.app.json` (does NOT check templates — `ng build` does)
- No lint config, no spec files. 2 known pre-existing NG8107 warnings in `verdiq/verdicts/verdict-review.html`.

## Apps & routes (src/app/app.routes.ts)
| App | Base route | Backend / auth |
|---|---|---|
| Vamaha | `/apps/vamaha` (Articles list), `/push`, `/articles/new`, `/articles/:id` (editor) | vamaha-backend `apiBaseUrl` (:9991 local), shell JWT |
| EMI Planner | `/apps/emi-planner/{analytics,push,feedback}` | vamaha-backend |
| Verdiq | `/apps/verdiq/{overview,products,coverage,verdicts,additives,double-standards,alternatives,analytics,submissions,reports,feedback,ingest,users}` | verdiq-backend, silent service login (`verdiqSessionGuard`) |
| RenewLoop | `/apps/renewloop/{users,activity,feedback,errors,notifications}` | sbmint backend, silent service login (`renewloopSessionGuard`) |
Also: `/` directory (home), `/settings`, `/settings/admins` (superadmin), `/login`, and the signed-out
`/forgot-password`, `/reset-password?token=`, `/accept-invite?token=`. Signed-in routes use `authGuard`
(token in localStorage `vamaha_admin_token`).

## Admin accounts & permissions
Identity and permissions live in vamaha-backend (see `vamaha-backend/docs/ADMIN-ACCOUNTS.md`).
`GET /auth/me` returns `permissions { superadmin, apps: { [appId]: { role, modules } }, catalog }`:
SUPERADMIN sees everything; ADMIN has per-app `VIEWER < EDITOR < MANAGER` plus an optional module
allow-list (module id = nav item `module` or first path segment; Vamaha's '' Articles item sets
`module: 'articles'`). The backend enforces it; the console mirrors it:
- `PermissionService` (`canApp`, `can(app, module, 'view'|'edit'|'manage')`, `canNav`, `visibleApps`,
  `isSuperadmin`). Home, app switcher, sidebar and command palette only list what the admin can open.
- Every app route has `appAccessGuard` (app) + `canActivateChild: [appModuleGuard]` (module; redirects
  to the first allowed module). `/settings/admins` has `superadminGuard`. **New app routes need both guards.**
- **New actions:** hide or disable by level in the UI (`perms.can(...)`) *and* put `@AppPermission` on the
  backend route. Done so far: push send/run-cron (manage), RenewLoop notify/send (manage), feedback/error
  triage (edit), Vamaha "New article" (edit).
- Verdiq/RenewLoop sessions come from the vamaha-backend **session broker** (`POST /app-sessions/:appId`,
  `AppSessionService` → `adoptSession` on each app's auth service). No service password is in this bundle.
- Pages: `settings/admins` (invite with per-app role + module ticks, edit, resend invite, send reset,
  deactivate, audit log tab), Settings (change password, "your access"), auth pages share
  `shared/components/auth-layout` and `password-fields` (≥ 10 characters + confirm).

Each app route uses `AppShellComponent` with route `data`: `appId` (matches APP_REGISTRY id),
`appName`, `navItems: AppNavItem[]` (label, `icon` = IconName, `path`, optional `activePrefixes`),
optional `contentClass` (Verdiq uses `verdiq-app`). Article editor routes are shell children so
they get header + sidebar; `activePrefixes: ['articles']` keeps "Articles" highlighted.

**Adding an app:** add an `AppTile` to `core/models/app-registry.model.ts` (logo file in `public/`),
add a route with `AppShellComponent` + data as above. Directory, app switcher and shell pick it up.
`tagline` shows in the directory, switcher panel and sidebar header; `accentColor` (a `var(--color-…)` token)
drives the switcher dot and the sidebar's active marker via `--app-accent`. Optional `crashConsoleUrl`
(native crash console, e.g. Play Console Android vitals) is linked from the app's Errors page.
Nav items may carry `group` (sidebar section label + command-palette entry); Verdiq uses Insights/Catalog/Moderation/Admin.

## Shared components (src/app/shared/components/)
- `global-header` — 64px, edge-to-edge, `bg-surface`. Left: studio wordmark `public/vamaha-wordmark(-dark).png` (cropped from `vVamahaS.png`; light/dark swapped via `.wordmark-light/-dark` in styles.css because Tailwind `dark:` isn't class-based here; only the V shows inside an app below 640px). Never use an app's square icon as the platform mark. Inside an app shows `›` + `app-switcher` pill (icon, accent dot, taglines in panel) + mobile menu button. Right: search trigger for the command palette + `account-menu` (theme switch, Settings, Sign out; Esc/outside-click close)
- `app-shell` — header + sidebar form one `bg-surface` L-frame; `<main class="shell-content">` is the inset `bg-bg` canvas (rounded top-left at md+, owns page padding). Sets `--app-accent` from `AppTile.accentColor` and provides `ShellContext` (app name, base path, active nav item) to everything inside.
- `app-sidebar` — app header (icon, name, tagline) + nav grouped by `AppNavItem.group` (default "Modules") + footer (All applications, Collapse). Active item = raised `bg-card` + `--app-accent` marker/icon. 240px at md+, collapsible to a 64px icon rail (`.sidebar.is-rail`, localStorage `vamaha_admin_sidebar_collapsed`); off-canvas drawer below md
- `app-row` — numbered directory row (home page); whole row is one link; optional `status` (checking/ok/down) + `metric` (Home probes each backend)
- `page-header` — `<app-page-header title description>` + projected actions. Inside a shell the breadcrumb is automatic (App › Page, or App › Module › Page below a module); `[breadcrumb]` overrides. Markup descriptions: project `<span pageDescription>…</span>`
- `status-badge` — `<app-status-badge [status]="'PUBLISHED'">`; maps DRAFT/IN_REVIEW/PUBLISHED/PENDING/ACTIVE/INACTIVE/FAILED to tone + label
- `icon` — `<app-icon name="bell" [size]="18">`; inline SVG registry (add new names in `ICONS`). No emoji icons, no icon library.
- `modal` (focus moves in, Tab trapped, Esc, focus returns) · `confirm-delete-modal` (type-to-confirm for irreversible deletes)
- `confirm-dialog` + `ConfirmService.ask({title, message, confirmLabel, tone})` → `Promise<boolean>`. Never `window.confirm()`.
- `auth-layout` (two-panel signed-out frame; project the form) · `password-fields` (new + confirm, show/hide, rule checklist; `[(password)]`, `[(confirm)]`)
- `toaster` + `ToastService.success/error/info` — outcomes of actions (saved, sent). Blocking load errors stay inline (`.state.error`).
- `empty-state` (icon, title, body, projected action) · `skeleton` (`variant` rows/stats/cards) · `pagination` (page, pageSize, total; "Showing x–y of n" + first/prev/numbered/next/last, always visible)
- `shared/utils/avatar.ts` — `initials(name)` + `avatarColor(id)` (stable palette token per person) for the `.avatar` class
- `push-composer` (labelled title/message, counters, lock-screen preview) · `push-console` (whole retention-push page; wrappers pass app slugs)
- `theme-switch` + `ThemeService` (light/dark/system → `html.dark`; pre-boot script in index.html; key `vamaha_admin_theme`)
- `command-palette` + `CommandPaletteService` — Ctrl/⌘+K; apps, every route's `navItems`, actions. Mounted in app.html

## Design system — rules
- **Edge to edge always.** No centered `max-w-* mx-auto` page/header shells. Side padding comes from
  `--page-px` / `--page-py` (16/24 → 24/28 at 768 → 32/32 at 1200), via `.shell-content` or `px-[var(--page-px)]`.
  Narrow widths only for inner reading columns (editor, forms).
- **Colors only from `src/styles/colors.css`** (light + `html.dark`). Tokens: bg, surface, card, text, text2, border,
  primary, primary-hover, accent, success, warning, danger, gold, blue, sage, hover, pressed, focus,
  chart-1..3 (data series only, in that order — validated with the dataviz skill; never for actions/status).
  Tailwind names = token names (`bg-hover`, `text-text2`, `outline-focus`…). Opacity modifiers work
  (`bg-success/10`) because tailwind.config wraps vars in `color-mix(... <alpha-value>)`.
  Never raw Tailwind palette (`text-red-600`) or hex in templates.
- **Typography:** Manrope everywhere incl. headings. `.font-display` (Fraunces) only for signature marks
  (directory row numbers, ink seal, loading stamp). Page title 24/32 600 (directory: 32/38).
- **Component CSS classes** (styles.css `@layer components`) — use these, don't restyle per page:
  `.page` (column, 24px gap) · `.page-head` / `.page-head__actions` · `.muted` · `.section-title`
  `.card` (12px radius, no shadow) · `.list` + `.list-row` (hover/pressed/focus built in) · `.state` / `.state.error`
  `.btn` (primary) · `.btn-secondary` (= `.btn-ghost`) · `.btn-tertiary` · `.btn-danger` · `.btn-sm` · `.icon-btn`
  `.input` (also select/textarea) · `.field-label` · `.field-help` · `.field-error`
  `.badge` + `.badge-{success,warning,danger,info,neutral}` (`.pill.yes/.no/.neutral` = legacy Verdiq aliases)
  `.data-table` inside `.card.table-scroll` · `.page-toolbar` (full-bleed sticky bar, e.g. editor)
  `.stat` + `__label/__value/__hint/__row/__delta(.up/.down/.new)` in `.stat-grid` (`.stat.is-alert`) · `.segmented` (2–3 mutually exclusive views only: buttons with `aria-pressed`, `.segmented__count`; list filters with more options use `.select-field`)
  `.card-toolbar` (+ `__group`: left = title + count badge, right = filters + search) on top of a list card · `.search-field` (icon + `.input`) · `.select-field` (native `<select class="input">` + trailing `chevron-down` icon; `.select-field.w-full` in forms) · `.th-sort` in `<th aria-sort>` (always show a sort icon; idle = `chevrons-up-down` with `.sort-idle`) · `.skeleton` · `.kbd` · `.fb-new` (unread rail)
  `.data-table.is-compact` (tinted sentence-case header, 6px rows, middle-aligned) · `.col-check` (row-select checkbox column) · `tr.is-selected` · `.avatar` (initials; tint with `--avatar-color`) · `.icon-btn.is-sm` (30px, dense tables)
  `.kpi-grid` + `.kpi` (`__label`, `__body`, `__icon` tinted by `--kpi-color`, `__value`, `__foot` with `.stat__delta` chip): summary cards above a list
- List page references: `vamaha/admin-dashboard` (stats + toolbar + grid rows), `verdiq/products/products-list`, and RenewLoop (the monitoring reference):
  `renewloop/users` (KPI cards + toolbar with dropdown filter + search + compact sortable table with row selection + detail modal),
  `renewloop/activity` (user-picker combobox, `?userId=` focused view with profile strip),
  `renewloop/feedback` and `renewloop/errors` (status KPIs + filter dropdowns + triage modal with status + note).
- Radius: 8px controls/nav items, 12px surfaces, 999px pills. Focus: 2px `--color-focus` outline. Hover only under
  `@media (hover:hover)`. Respect `motion-reduce`. Touch targets ≥44px (`min-h-11`). No heavy shadows/gradients
  (dropdowns use `shadow-md`).
- **Verdiq** keeps legacy token names (`--primary`, `--avoid`, `--text-muted`…) inside `.verdiq-app`, but
  `pages/apps/verdiq/verdiq-globals.css` maps them all to platform tokens. Don't name a class `grid` on a
  table (collides with Tailwind) — use `.data-table`.
- Page pattern:
  ```html
  <div class="page">
    <app-page-header title="…" description="…">
      <button class="btn btn-secondary">…</button>
    </app-page-header>
    @if (loading()) { <app-skeleton /> }
    @else if (error()) { <div class="card state error" role="alert">{{ error() }}</div> }
    @else if (!items().length) { <div class="card"><app-empty-state icon="inbox" title="Nothing yet" /></div> }
    @else { … }
  </div>
  ```

## Known issues / not done
- RenewLoop `apiBaseUrl` is the local sbmint (`127.0.0.1:3300`). Its `npm run dev` doesn't reload code, so after pulling backend changes restart it, or new pages 404 and show "Could not load …".
- RenewLoop `crashConsoleUrl` is the generic Play Console URL; replace it with the app's Android vitals link.
- The Verdiq/RenewLoop service passwords were removed from `environment.ts` (broker now) but are still in **git history**: rotate them and set the new ones only on vamaha-backend.
- Broad legacy rules in styles.css (`form input/label … !important`) still apply app-wide; `.btn` submit buttons opt out.
- `public/renewloop.png` is ~1 MB for a 40px icon.
- Verdiq review queues (submissions, reports, ingest, feedback, verdicts) and forms (additives, alternatives, double-standards, users) still use Verdiq-local card/form styles inside the shared header/states.
- `PushAdminService.listApps()` only returns `emi-planner`, so the Vamaha push page manages EMI Planner's devices.
- Home probes each backend the admin can open (Verdiq/RenewLoop via the broker) for its status dots.
- Article editor actions (publish/delete) are refused by the backend for non-editors but not yet hidden in the editor UI.
- Inside the Vamaha app on phones, the brand V and the Vamaha app icon (also a V) sit side by side.
- Pages verified only in error/empty states (no local backends); re-check data-heavy pages with live data.

## Local testing without backends
Playwright: route-mock `**/api/auth/me` → `{success:true,data:{id,email,name,role}}`, set
`localStorage.vamaha_admin_token`, then navigate. App pages render their error states without backends.
