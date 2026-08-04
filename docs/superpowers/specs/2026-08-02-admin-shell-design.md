# Admin Shell — Tile-Based Multi-App Console (Design Spec)

## Context

`vamaha-www` currently is a single-purpose admin app: log in, land directly on the
Vamaha article/push dashboard. The company now has (and will keep adding) more apps
— EMI Planner (live, ~no users yet) and Verdiq: Child Food Scanner (has its own
mature admin app, `verdiq-admin`, hitting a separate backend, `verdiq-backend`) —
and wants one admin console instead of one per app, to avoid multiple domains/
deployments and to make adding future apps cheap.

This spec covers turning `vamaha-www` into a shell: login → a tile grid (one tile
per app + a Settings tile) → each tile lazy-loads only its own module. It wires in
what already exists (Vamaha articles/push) plus a new, real EMI Planner analytics
tile. **Migrating Verdiq's admin (12 feature areas, separate backend/auth) is
explicitly out of scope — a separate future spec**, to be designed once this shell
exists and the pattern is proven.

## Scope

- Restructure `vamaha-www` routing: tile-home screen at `/`, existing admin pages
  moved under `/apps/vamaha/...`, new EMI Planner analytics under
  `/apps/emi-planner/...`, new `/settings` page.
- New `AppTile` registry (`core/models/app-registry.model.ts`) — the single place
  new apps get added later.
- New EMI Planner analytics tile, wired to `vamaha-backend`'s existing
  `GET /analytics/summary` endpoint (no backend changes this phase — see
  "Analytics scope" below).
- New Settings page: logged-in admin's name/email/role + sign out. No app-registry
  editing UI this phase.
- Out of scope: Verdiq migration, cross-backend silent-login implementation (the
  extension point is documented/stubbed but not exercised — both tiles in this
  phase share one backend/one auth), backend `appSlug` filtering for analytics,
  DNS/deploy changes.

## Auth model

One shell login (existing `AuthService`/`authGuard`/`authInterceptor`, unchanged)
gates every route except `/login`. Both tiles built in this phase (Vamaha admin,
EMI Planner analytics) hit `vamaha-backend` and reuse the shell's token directly —
no new auth wiring needed.

For future apps on a different backend (Verdiq), the plan is: a small
`AppSessionService` performs a one-time silent login per session using a stored
service credential in that app's environment config, caches the resulting token,
and an app-scoped interceptor attaches it only to that backend's calls. This
service credential ships inside the compiled frontend bundle — acceptable for an
internal, login-gated tool, but it is not a server-side secret in the strict sense.
This phase only stubs the extension point (an `authMode` field on the registry
entry); it does not implement or exercise cross-backend login.

## Architecture

```
src/app/
  core/
    models/
      app-registry.model.ts   → AppTile interface + APP_REGISTRY constant
    services/
      app-session.service.ts  → stub for future cross-backend silent-login (unused
                                  this phase — both live tiles use shell auth)
      analytics.service.ts    → new: GET /analytics/summary via vamaha-backend
  pages/
    home/                     → tile grid: APP_REGISTRY entries + Settings tile
    settings/                 → profile (name/email/role) + sign out
    auth/login/               → unchanged
    apps/
      vamaha/
        admin-dashboard/      → moved from pages/admin/admin-dashboard, unchanged
        admin-article/        → moved from pages/admin/admin-article, unchanged
        admin-push/           → moved from pages/admin/admin-push, unchanged
      emi-planner/
        analytics/            → new: AnalyticsComponent
  app.routes.ts               → rewritten, see Routing below
```

Nothing in `auth.service.ts`, `auth.guard.ts`, `auth.interceptor.ts`,
`admin-content.service.ts`, `push-admin.service.ts`, or `markdown-editor/` changes
— they relocate (import-path updates only) but their content is untouched.

## Routing

```
'' (guarded)                          → HomeComponent (tile grid)
'login'                               → LoginComponent
'settings' (guarded)                  → SettingsComponent
'apps/vamaha' (guarded)               → AdminDashboardComponent
'apps/vamaha/articles/:id' (guarded)  → AdminArticleComponent
'apps/vamaha/push' (guarded)          → AdminPushComponent
'apps/emi-planner/analytics' (guarded)→ AnalyticsComponent
'**'                                  → redirectTo ''
```

`authGuard` now applies to `''` and `'settings'` in addition to the `apps/*`
routes (wider coverage than today, where only `admin*` was guarded). Internal
`routerLink`/`router.navigate()` references inside the moved Vamaha pages
(`/admin` → `/apps/vamaha`, `/admin/push` → `/apps/vamaha/push`, etc.) get updated
as part of the move — mechanical, not a design change.

## Analytics scope (this phase)

`vamaha-backend`'s `GET /analytics/summary?days=N` returns global breakdowns (by
type/country/device/browser/referrer across all apps) plus a `byApp` array with
per-app event counts. It has no `appSlug` filter today.

This phase's `AnalyticsComponent` calls this endpoint as-is and extracts
`response.byApp.find(a => a.appSlug === 'emi-planner')` for the EMI-Planner-specific
event count. Unique-visitor count in the response is site-wide, not per-app — the
UI labels it "site-wide" rather than implying it's EMI-Planner-scoped. Full
per-app breakdowns (countries/devices/browsers filtered to one app) require a
backend change (`appSlug` query param scoping every groupBy) — deferred to a later
phase once there's real EMI Planner traffic to analyze.

## Testing

Same convention as the rest of this project: `npx tsc --noEmit` after every
change, `ng build` + a fresh `ng serve` + hard browser refresh before calling any
task done (a stale dev-server cache was mistaken for a styling bug once already in
this project — always verify against a freshly started server). No unit test
framework.

## Out of scope

- Verdiq admin migration (12 feature areas, separate backend/auth) — future spec.
- Cross-backend silent-login implementation — stubbed, not built.
- Backend `appSlug` analytics filtering — future, once EMI Planner has real traffic.
- App-registry editing UI in Settings — future, if needed.
- DNS/deploy changes.
