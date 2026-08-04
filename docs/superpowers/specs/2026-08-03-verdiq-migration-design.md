# Verdiq Migration — Design Spec

## Context

The 2026-08-02 admin-shell spec (`2026-08-02-admin-shell-design.md`) turned
`vamaha-www` into a tile-based shell (login → tile grid → per-app module) and
explicitly deferred migrating Verdiq's admin: "Migrating Verdiq's admin (12
feature areas, separate backend/auth) is explicitly out of scope — a separate
future spec." That shell now exists (Vamaha + EMI Planner tiles live). This
spec is that follow-up: bring `verdiq-admin`'s 12 built feature areas into
`vamaha-www` as the Verdiq tile.

`verdiq-admin` (`C:\Users\Admin\Documents\verdiq\verdiq-admin`) is a separate,
fully-built Angular admin app: its own JWT auth, its own backend
(`verdiq-backend`, Fastify + Neon, distinct from `vamaha-backend`), and 12
feature areas (Overview, Products + detail, Coverage & gaps, Verdict review,
Additives, Double standards, Alternatives, Analytics, Submissions, Reports,
Feedback, Ingest review, Users & testers) — roughly 52 feature files plus 14
models and 2 core services.

## Scope

- Port all 12 verdiq-admin feature areas into `vamaha-www` under
  `apps/verdiq/*`, reusing `AppShellComponent` for the tile chrome instead of
  verdiq-admin's own `MainLayout`/`Sidebar`/`Header`/`Footer`.
- Implement the previously-stubbed cross-backend silent login
  (`AppSessionService`) for real, scoped to verdiq-backend only.
- Add a `verdiqApiBaseUrl` + service-credential entry to `environment.ts`
  (placeholder values — real credentials filled in locally, never pasted into
  chat or committed with real values in a public repo).
- Scope verdiq's shared global stylesheet under `.verdiq-app` to avoid class
  collisions with Tailwind (see Styling section).
- Out of scope: verdiq-admin's own login/forgot-password/reset-password pages
  (replaced by silent login), decommissioning verdiq-admin's standalone
  deployment (left running as-is), any backend code changes beyond a
  production `ALLOWED_ORIGINS` addition (deploy-time config, not code), a
  Tailwind reskin of verdiq's pages (mechanical port only — matches how
  Vamaha's own pages were moved "unchanged" per the prior spec).

## Auth model

Verdiq-backend has its own JWT auth (`/auth/login`), entirely separate from
`vamaha-backend`'s. The chosen approach: silent service-credential login,
matching the extension point already documented in the admin-shell spec.

- `environment.ts` gains a `verdiq: { apiBaseUrl, serviceEmail,
  servicePassword }` block. The credential belongs to an existing admin
  account on verdiq-backend (supplied by the user directly into the file, not
  through chat).
- `AppSessionService.ensureVerdiqSession()`: if no cached verdiq token exists
  yet this session, POSTs `{ email, password }` to
  `${environment.verdiq.apiBaseUrl}/auth/login`, caches the returned JWT
  in-memory (mirrors `AppSessionService`'s existing `tokens: Map<string,
  string>` shape, keyed `'verdiq'`).
- `verdiqAuthInterceptor` (new, alongside the existing `authInterceptor`):
  attaches `Authorization: Bearer <verdiq token>` only to requests whose URL
  starts with `environment.verdiq.apiBaseUrl`; leaves every other request
  (including vamaha-backend calls) untouched, exactly like the existing
  interceptor's URL-prefix gating.
- `verdiqSessionGuard` (new `CanActivateFn`): awaits
  `ensureVerdiqSession()` before letting `apps/verdiq/*` activate. Runs after
  the existing `authGuard` (shell login still required first). Every ported
  feature component can assume a valid verdiq token already exists by the
  time it fires its first HTTP call — no per-component readiness checks
  needed.
- No per-user distinction: every vamaha-www admin who reaches the Verdiq tile
  gets the same verdiq-backend service identity. Acceptable for an internal,
  already login-gated console (same reasoning the admin-shell spec used to
  accept the credential shipping inside the compiled bundle).

## Architecture

```
vamaha-www/src/
  environments/environment.ts        → + verdiq: { apiBaseUrl, serviceEmail, servicePassword }
  app/
    core/
      services/
        app-session.service.ts       → + ensureVerdiqSession(), backed by existing tokens map
      interceptors/
        verdiq-auth.interceptor.ts   → new: attaches verdiq token to verdiq-backend calls only
      guards/
        verdiq-session.guard.ts      → new: awaits ensureVerdiqSession()
      models/
        verdiq/                     → the 14 ported model files (additive, product, verdict, …)
    shared/components/app-shell/
      app-shell.component.ts/.html   → + optional `contentClass` route-data field, applied to <main>
    pages/apps/verdiq/
      overview/
      products/ (list + detail)
      coverage/
      verdicts/
      additives/
      double-standards/
      alternatives/
      analytics/
      submissions/
      reports/
      feedback/
      ingest/
      users/
      services/                     → ported per-feature services (admin-api, storage, per-feature API calls)
      verdiq-globals.css            → verdiq-admin's global styles.sass, re-nested under `.verdiq-app`
    app.routes.ts                    → + apps/verdiq parent route (see Routing)
```

Each feature folder is a near-verbatim copy of verdiq-admin's
`features/<x>/pages/<y>/` (`.ts`, `.html`, `.sass` unchanged in content).
Mechanical changes only: import paths (environment, models, services) updated
to their new home, and each feature service's `environment.apiBaseUrl`
reference becomes `environment.verdiq.apiBaseUrl`.

## Routing

```
'apps/verdiq' (authGuard, verdiqSessionGuard)  → AppShellComponent
  data: { appName: 'Verdiq', appIcon: '🧩', contentClass: 'verdiq-app',
          navItems: [ 13 items: Overview, Products, Coverage & gaps,
                       Verdict review, Additives (INS), Double standards,
                       Alternatives, Analytics, Submissions, Reports,
                       Feedback, Ingest review, Users & testers ] }
  children:
    ''                     → redirectTo 'overview'
    'overview'             → Overview
    'products'             → ProductsList
    'products/new'         → ProductDetail   (must precede 'products/:id')
    'products/:id'         → ProductDetail
    'coverage'             → Coverage
    'verdicts'             → VerdictReview
    'additives'            → Additives
    'double-standards'     → DoubleStandards
    'alternatives'         → Alternatives
    'analytics'            → Analytics
    'submissions'          → Submissions
    'reports'              → Reports
    'feedback'             → Feedback
    'ingest'               → Ingest
    'users'                → Users
```

This is the same shape as verdiq-admin's own `app.routes.ts` (order matters:
`products/new` before `products/:id`), minus the auth pages and the
`MainLayout` wrapper — `AppShellComponent` replaces that chrome.
`APP_REGISTRY`'s existing `verdiq` entry's `route` updates from
`/apps/verdiq/analytics` to `/apps/verdiq` (landing on Overview like the other
tiles, not Analytics — Analytics was only the placeholder default before this
migration existed).

## Styling

verdiq-admin ships a shared global stylesheet (`styles.sass`) with utility
classes every feature template uses directly: `.card`, `.btn`/`.btn-ghost`/
`.btn-danger`, `.page`/`.page-head`, `.panel`, `.grid`/`.mini-table`, `.pill`,
`.state`, `.cols`, `.muted`, `.input`, `.icon-btn`, `.table-scroll` — plus a
`:root` block of CSS custom properties (`--surface`, `--border`,
`--text-muted`, `--primary`, `--ok`, `--caution`, `--avoid`, `--shadow`, …).

Dropping this in globally is unsafe: Tailwind (used throughout the rest of
`vamaha-www`) defines its own `.grid { display: grid }` utility, which would
directly collide with verdiq's `.grid` (a bordered data-table class). Fix:

1. Copy `styles.sass` to `pages/apps/verdiq/verdiq-globals.css`, re-indenting
   every rule (including the `:root` variable block) one level under a
   `.verdiq-app` wrapper selector. Content is otherwise untouched — no
   per-file class renames needed anywhere else.
2. Import it once, globally, from `src/styles.css` (same place `colors.css`
   is imported) — safe because every selector inside is now prefixed
   `.verdiq-app `.
3. Add an optional `contentClass?: string` field to `AppShellComponent`,
   read from `route.snapshot.data['contentClass']`, applied as a class on its
   `<main>` element (`[class]="contentClass"` alongside the existing static
   classes). Every other tile's route omits this field, so `AppShellComponent`
   is otherwise unchanged for them.
4. Set `contentClass: 'verdiq-app'` only on the `apps/verdiq` route's `data`.

Each individual feature page's own component-scoped `.sass` file (e.g.
`overview.sass`) is copied verbatim. Angular's per-component style
encapsulation means these never leak into or collide with the rest of
`vamaha-www` regardless of nesting; CSS custom properties still resolve
correctly since they inherit down the live DOM from the `.verdiq-app`
ancestor, independent of Angular's style-scoping mechanism.

## Data flow / error handling

Unchanged from verdiq-admin's own pattern — each feature's own service class
(e.g. `products.service.ts`) calls `verdiq-backend` endpoints directly via
`HttpClient`, using `environment.verdiq.apiBaseUrl`. `verdiqAuthInterceptor`
attaches the token transparently; a component never handles auth itself.
Existing per-component loading/error signal patterns (seen in
`AnalyticsComponent`'s `loading()`/`loadError()`) carry over unchanged since
the component code isn't rewritten, only relocated.

## Deployment note (not code, tracked here for completeness)

verdiq-backend's CORS (`plugins/cors.ts`) only allows configured origins in
production. Once `vamaha-www`'s production domain serves the Verdiq tile,
verdiq-backend's `ALLOWED_ORIGINS` env var needs that domain added — an infra
change, not part of this migration's code.

## Testing

Same convention as the rest of `vamaha-www`: `npx tsc --noEmit` after every
change, `ng build` + a fresh `ng serve` + hard browser refresh before calling
any task done. No unit test framework in this project.

## Out of scope

- verdiq-admin's own login/forgot-password/reset-password pages.
- Decommissioning the standalone verdiq-admin deployment.
- Any verdiq-backend code change (only a prod `ALLOWED_ORIGINS` config
  addition, at deploy time).
- Tailwind reskin of verdiq's ported pages.
- Per-user verdiq permissions (single shared service identity for all
  vamaha-www admins).
