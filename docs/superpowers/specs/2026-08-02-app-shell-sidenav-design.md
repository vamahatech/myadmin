# App Shell Side-Nav Design

## Problem

Each app tile in the admin shell (Vamaha, EMI Planner) currently renders its
features as flat, independent routes stitched together with manual links
inside each page (`apps/vamaha`, `apps/vamaha/push`,
`apps/vamaha/articles/:id`). There's no shared navigation shell inside an
app. This doesn't scale: Vamaha already has 2 features, EMI Planner will
grow beyond Analytics, and a future Verdiq migration would bring ~12
feature areas. Verdiq migration itself stays out of scope (per the prior
admin-shell spec) — this spec only restructures navigation for the apps
that exist today: Vamaha and EMI Planner.

## Goal

Give every app inside the admin shell a consistent side-nav layout so
adding a new feature to an app means adding one route + one nav item, not
inventing another ad-hoc top bar.

## Architecture

Each app's routes become a parent route wrapped by one shared
`AppShellComponent`, with feature pages as its children:

```
apps/vamaha              → AppShellComponent (parent, canActivate: authGuard)
  ├── '' (default)       → AdminDashboardComponent (Articles)
  └── push                → AdminPushComponent

apps/emi-planner          → AppShellComponent (parent, canActivate: authGuard)
  └── analytics (default) → AnalyticsComponent
```

`authGuard` is declared once on the parent route; children inherit it
(Angular's `canActivate` on a parent route gates all its children). Each
parent route carries static route `data`:

```ts
data: {
  appName: 'Vamaha',
  appIcon: '📝',
  navItems: [
    { label: 'Articles', icon: '📰', path: '' },
    { label: 'Push notifications', icon: '🔔', path: 'push' },
  ],
}
```

`AppShellComponent` reads `appName` / `appIcon` / `navItems` from
`ActivatedRoute.snapshot.data` — no new service, no new model file beyond
a small `NavItem` interface next to `AppShellComponent`.

## Components

**`AppShellComponent`** (new, shared: `src/app/shared/components/app-shell/`)
Standalone. Renders:
- Sidebar top: ink-seal + app icon/name, `routerLink="/"` (back to
  tile-home) — reuses the existing `.ink-seal` mark from the login/home
  visual identity.
- Sidebar middle: nav items from route data, `routerLinkActive` for the
  current feature.
- Sidebar bottom (pinned): Settings link, Sign out button — using the
  existing `AuthService.logout()` and the same sign-out behavior currently
  duplicated across `AdminDashboardComponent` and `AdminPushComponent`.
- Main area: `<router-outlet>` for the active feature component.
- Below a mobile breakpoint, the sidebar collapses to a horizontal top
  strip (this is an internal admin tool — a simple collapse is enough, no
  hamburger drawer).

**Existing feature components** (`AdminDashboardComponent`,
`AdminPushComponent`, `AnalyticsComponent`) lose their own header markup
(sign-out button, back-to-home click handler, app name/title, the
Vamaha-specific "Push Notifications" link) since `AppShellComponent` now
owns all of that. Their content (forms, article list, push form, analytics
cards) is unchanged.

**Home tile-home page**: the `logout.svg` icon + `logout()` handler added
directly to `HomeComponent`'s header in the prior uncommitted work
(commit `cc8c0ce`) stays as-is — tile-home is outside any app shell and
keeps its own sign-out affordance for when the user hasn't entered an app
yet.

**`app-registry.model.ts`**: the `verdiq` tile entry added in `cc8c0ce`
stays in the registry but is **not** wired to a real route in this spec —
its `route: '/apps/verdiq/analytics'` will 404 until Verdiq is actually
migrated (tracked as the existing, separately-scoped future work). This
spec does not add an `apps/verdiq` route.

## Data flow

No new data flow. `AppShellComponent` reads static route `data` (no HTTP
call) and reuses the existing `AuthService` (already injected app-wide) for
the logged-in user display and sign-out, exactly as today's pages do.

## Error handling

No new error paths. `authGuard` behavior is unchanged — declaring it once
on the parent instead of once per child route is a pure refactor of where
the check happens, not what it does. The existing 401 → login-redirect flow
in `authInterceptor` covers every child route the same way it does today.

## Testing

- `tsc --noEmit` and `ng build` to confirm the route restructure resolves
  and every lazy chunk still builds.
- Manual click-through per app: sidebar nav switches the active feature,
  back-to-tile-home works, Settings and Sign out work from inside an app.

## Out of scope

- Verdiq migration (tracked separately, per the prior admin-shell spec's
  explicit scoping decision).
- Wiring the `verdiq` registry tile to a real route.
- Any change to EMI Planner's or Vamaha's business logic — this is a
  layout/navigation refactor only.
