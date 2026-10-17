# myadmin Development Rules

How to build monitoring features in myadmin (and the backend endpoints behind them) so every
app looks and behaves the same. **What** to build and how metrics are defined is in
[monitoring-standard.md](monitoring-standard.md). The design-system details (tokens,
component classes, shell) are in [../../CLAUDE.md](../../CLAUDE.md). This file doesn't repeat them.

---

## 1. Build order for any monitoring feature

1. **Contract:** confirm the endpoint shape in monitoring-standard §5. If it needs to change,
   update the standard first, in the same change.
2. **Backend:** implement it in the app's backend, on a feature branch, with tests (§4).
3. **Types:** mirror the response exactly in `src/app/core/models/<app>/<resource>.model.ts`.
   Types describe what the server returns *today*, not what we hope it will.
4. **API client:** add methods to that app's `core/services/<app>/admin-api.ts`. Components
   never inject `HttpClient`.
5. **Page:** build from the shared building blocks (§3) under
   `src/app/pages/apps/<app>/<module>/`.
6. **Wire up:** route and `navItems` in `app.routes.ts` (app routes carry `appAccessGuard` and
   `canActivateChild: [appModuleGuard]`); the module id in vamaha-backend `APP_MODULES`;
   capability flag in the app registry.
6b. **Permissions:** every admin endpoint declares what it needs (`@AppPermission` in
   vamaha-backend; the app backend's admin check elsewhere), and the page hides or disables
   actions with `PermissionService.can(app, module, level)`: view = read, edit =
   create/edit/triage, manage = send/delete/export.
7. **Docs:** update the app status table (standard §9) and the app's `docs/events.md` if
   events changed.

## 2. Page structure (every monitoring page)

```
page-header (title; actions on the right)
[profile strip — only when focused on one user]
kpi-grid (.kpi cards — Overview / list pages that summarise)
card
  card-toolbar:  left = title + count badge (+ selection)   right = dropdown filters + search
  table (.data-table.is-compact) | empty-state | skeleton
  app-pagination
```

- **Four states, always:** loading (skeleton), error (inline `.card.state.error`), empty
  (`app-empty-state` that says *what* to do or instrument), data. No page skips one.
- **Filters:** use dropdowns (`.select-field`) when there are more than 3 options or the
  toolbar is busy. Use `.segmented` only for 2–3 mutually exclusive views. Search sits on the
  far right. Changing a filter resets to page 1.
- **Searches** are debounced 250–300 ms. Ignore a response if the user has typed past it.
- **Tables:** compact variant. Sortable columns always show a sort icon. Numbers and dates
  are `tabular-nums`. Show dates as `dd MMM yyyy`, with the full timestamp in `title`.
  Long text truncates, with the full value in `title`.
- **People:** show an initials avatar (`shared/utils/avatar.ts`) and the name. Email is
  secondary text or a tooltip. Clicking a person opens their detail (panel or focused view).
- **Focus on one user:** the user is in the URL (`?userId=`), so the view can be linked and
  survives a reload. Redundant columns are hidden. "Show all" clears it.
- **KPI cards:** a label, the value, and a footer with a delta chip or context line. Show a
  delta only when it's comparable (standard §3). Mark capped values with `+`.
- **Actions:** destructive or account-affecting actions go through `ConfirmService` (with a
  reason field where the standard requires one). Report the outcome with `ToastService`.
  Never use `window.confirm`/`alert`.
- **Edge to edge.** No centred max-width shells. Must work at 360 px (toolbar wraps, table
  scrolls horizontally inside its card).

## 3. Shared building blocks (reuse before writing new)

| Need | Use |
|---|---|
| Page title / breadcrumb | `app-page-header` |
| Summary numbers | `.kpi-grid` + `.kpi` (`__label/__body/__icon/__value/__foot`) + `.stat__delta` |
| List toolbar | `.card-toolbar` + `__group`, `.select-field` (`.w-full` in forms), `.search-field` |
| Tables | `.data-table.is-compact`, `.th-sort`, `.col-check`, `.avatar` |
| Paging | `app-pagination` (numbered, first/prev/next/last) |
| Empty / loading | `app-empty-state`, `app-skeleton` |
| Dialogs | `app-modal`, `ConfirmService`, `confirm-delete-modal` (type-to-confirm) |
| Triage (status + note) | the modal pattern in `renewloop/feedback` and `renewloop/errors` |
| Notifications | `push-composer`, `push-console` |
| Icons | `app-icon` (add paths to `ICONS`; no icon libraries, no emoji) |

When a pattern appears on a **second** app, promote it to `shared/` instead of copying it.
Planned promotions when the second app needs them: the user picker combobox (RenewLoop
Activity), the KPI card (as a component), the activity table, the feedback inbox and error
issue table with their triage modal, and the error reporter + interceptor for Angular/Ionic
apps (RenewLoop `submint`).

## 4. Backend endpoint rules (every app backend)

- **Validate** every query and body with the backend's schema library (zod / class-validator).
  Coerce numbers and dates. `limit` max 100. Ids are validated before they hit the DB.
- **Paginate** with `{ <resource>: [], pagination: { page, limit, total, totalPages } }`.
  Run count and page queries in parallel.
- **Index every filter and sort** you expose (e.g. `{ userId: 1, createdAt: -1 }`).
- **Return only public fields.** Map documents through a `toPublic…` function. Never return
  password hashes, OTPs, tokens, fingerprints or raw provider payloads.
- **UTC** for all date maths and bucketing.
- **Audit** every admin write (standard §4.5), inside the service, not the controller.
- **Tracking is fire-and-forget.** Recording an event or error must never fail or slow the
  request that triggered it.
- **Tests:** unit tests for the service (mock the models) and validation tests for the schema.
  Plus one check against the real database for new queries, using the integration-test DB,
  never a shared/live DB.
- **Migrations are additive.** Never run migrations against a database shared with other
  projects without confirming the target first (see vamaha-backend docs).

## 5. Frontend code rules

- Angular standalone components, signals for state, `@if/@for` control flow. Signals over RxJS
  except for streams (search debounce, route params). Subscriptions use `takeUntilDestroyed`.
- One component per page. If a template passes ~250 lines, split it into child components.
- Types come from `core/models/<app>/`; no `any` in services. `$any($event.target)` is
  acceptable only for DOM event values in templates.
- Colours only from tokens; never hex or raw Tailwind palette classes in templates.
- Accessibility: every input has a label (visible or `sr-only`). Icon buttons have
  `aria-label`. Sortable headers set `aria-sort`. Comboboxes set
  `role/aria-expanded/aria-activedescendant`. Focus is visible. Hit targets are ≥ 30 px in
  dense tables and ≥ 44 px elsewhere.
- Don't build what the API can't back. If data is missing, show an honest empty state or
  leave the module out. Never use placeholder numbers.
- Verify with `npx ng build` (it type-checks templates). The two NG8107 warnings in
  `verdiq-review` are known; don't add new warnings.

## 6. Naming

| Thing | Convention | Example |
|---|---|---|
| Route | `/apps/<app-id>/<module>` | `/apps/renewloop/activity` |
| Page files | `pages/apps/<app>/<module>/<module>.ts/.html` | `renewloop/activity/activity.ts` |
| Component class | `<App><Module>` | `RenewloopActivity` |
| Model file | `core/models/<app>/<resource>.model.ts` | `renewloop/activity.model.ts` |
| Events | `object_action`, past tense, snake_case | `password_changed` |
| Audit actions | `resource.verb` | `user.suspend` |
| Query params | camelCase, matching the API | `?userId=…&event=…` |

## 7. Git

- Work on a feature branch in the main checkout (no worktrees unless asked).
- Backend and myadmin are separate repos: commit each separately. Deploy the backend first.
- Commit messages: `type(scope): summary` + a short body. No AI co-author trailers.

## Definition of done

A monitoring feature is done when:

- [ ] Endpoint matches monitoring-standard §5 (or the standard was updated in the same change)
- [ ] Backend tests pass, and new queries were checked against a real (test) database
- [ ] Admin writes are audited; events/errors contain no forbidden data (standard §8)
- [ ] Endpoint has a permission requirement; the UI hides actions the role can't perform
- [ ] Privacy policy covers any new personal data
- [ ] The page has loading, error, empty and data states, and works at 360 px and in dark mode
- [ ] Metrics follow the definitions in standard §3 (unit labelled; deltas only when comparable)
- [ ] `npx ng build` passes with no new warnings
- [ ] Capability flag, routes and the app status table (standard §9) are updated
