# RenewLoop admin: user management + push notifications

Date: 2026-08-16

## Goal

Add a fourth tile — **RenewLoop** — to the `myadmin` admin dashboard, alongside
Vamaha, EMI Planner, and Verdiq. RenewLoop's data lives in the sbmint backend
(`c:\Users\Admin\Documents\project2\sbmint\backend`, Express + MongoDB), which
today has zero admin/role concept — only a single end-user account type. The
admin needs two capabilities against that backend:

1. **User management** — list/search RenewLoop end users, view a detail page,
   delete a user.
2. **Push notifications** — broadcast a push to every user with a registered
   device token, or send to one user, plus a Firebase-credential status
   indicator.

RenewLoop end users and the dashboard's admin operator are separate
populations — end users are never promoted to admin through this UI (unlike
Verdiq, where testers/users can also become admins).

## Auth pattern

Follows Verdiq's existing `service-credential` `authMode`: the sbmint backend
gains a minimal `isAdmin` flag and a `requireAdmin` route guard; the admin
dashboard silently logs in as one seeded admin account and calls the new
`/admin/*` routes with that token. `/auth/login` stays generic — it does not
reject non-admin credentials — every `/admin/*` route is individually guarded.

## Backend changes (sbmint `backend/`)

### `src/models/user.model.js`
- `createUser` gains `isAdmin: false` in the default doc.
- New: `setUserIsAdmin(userId, isAdmin)`.
- New: `searchUsersPage({ search, skip, limit })` — case-insensitive regex
  match on `name`/`email` when `search` is set, else all users; sorted by
  `createdAt` desc.
- New: `countUsers({ search })` — same filter, for pagination totals.
- Existing `findUserById` / `deleteUser` reused as-is for the detail and
  delete admin endpoints.

### `src/middleware/auth.middleware.js`
- New `requireAdmin(req, res, next)`, composed after `requireAuth` (which
  already sets `req.userId`): loads the user via `userModel.findUserById`,
  403s (`{ errors: ['Admin access required.'] }`) if missing or
  `isAdmin !== true`, else calls `next()`.

### `src/utils/jwt.js` / `src/modules/auth/auth.service.js`
- `signToken` payload gains `isAdmin: user.isAdmin` on both `register` and
  `login`, so the JWT itself carries the claim (mirrors Verdiq's `is_admin`
  claim, read by the frontend via a client-side JWT decode — no server
  round-trip needed to know admin status).
- `toPublicUser` includes `isAdmin` so `/auth/me` reflects it too.

### New module `src/modules/admin/`
`admin.routes.js`, `admin.controller.js`, `admin.service.js`,
`admin.validation.js` — every route behind `requireAuth, requireAdmin`,
mounted at `/admin` in `app.js`.

- `GET /admin/users?search=&page=&limit=`
  Paginated list. Each row: `id, name, email, createdAt, subscriptionsCount,
  hasDeviceToken, remindersEnabled`. Uses the existing
  `paginationQuerySchema` / `buildPaginationMeta` utils.
- `GET /admin/users/:id`
  Detail: profile fields + `subscriptionsCount` (via
  `subscriptionModel.countSubscriptionsByUserId`) + `hasDeviceToken` +
  notification preferences. 404 if not found or `:id` isn't a valid
  ObjectId.
- `DELETE /admin/users/:id`
  Reuses the same cascade as self-delete
  (`subscriptionModel.deleteSubscriptionsByUserId`,
  `notificationModel.deleteNotificationsByUserId`, `userModel.deleteUser`).
  400 (`self_delete`) if `:id` equals the caller's own `req.userId`. 404 if
  not found.
- `GET /admin/push/credential-status`
  `{ configured: boolean }` — `true` iff `FIREBASE_SERVICE_ACCOUNT_PATH` is
  set and loadable (reuses the existing lazy-init check already inside
  `utils/fcm.js`; add a small exported `isConfigured()` there rather than
  duplicating the file-read logic).
- `POST /admin/push/broadcast` `{ title, body }`
  Sends to every user with a non-null `deviceToken` via the existing
  `sendPushNotification`. On a "registration token not registered" FCM
  error, clears that user's `deviceToken` (stale-token cleanup, matching the
  vamaha-backend `push.service.ts` pattern). Returns
  `{ sent, failed, staleRemoved, total }`.
- `POST /admin/push/users/:id` `{ title, body }`
  Sends to one user. 400 (`no_device_token`) if the user has none. Same
  stale-token handling as broadcast.

### `scripts/seed-admin.js`
One-off script, run manually (`node scripts/seed-admin.js`) against the real
DB. Reads `ADMIN_EMAIL` / `ADMIN_PASSWORD` from env, hashes the password via
the existing `hashPassword` util, and upserts a user with `isAdmin: true`
(creates if the email doesn't exist, otherwise sets `isAdmin: true` and
updates the password hash on the existing account). Connects/disconnects the
DB itself since it runs outside the Express app lifecycle.

### Tests
Unit tests for `admin.service.js` alongside the existing `*.test.js` sibling
files (same convention as `subscription.service.test.js`): pagination/search,
delete cascade + self-delete guard, broadcast counts, stale-token cleanup on
a simulated FCM "not registered" error. Run via the project's existing test
command — no new test framework introduced.

## Frontend changes (`myadmin/`)

### `src/app/core/models/app-registry.model.ts`
Add a `renewloop` tile: `authMode: 'service-credential'`, route
`/apps/renewloop/users`, icon/tagline TBD at implementation time (visual
detail, not architecturally significant).

### `src/environments/environment*.ts`
Add a `renewloop: { apiBaseUrl, serviceEmail, servicePassword }` block, same
shape as the existing `verdiq` block (placeholder credentials in the
committed file, real values filled in locally — same comment convention as
today's `verdiq` block).

### `src/app/core/services/renewloop/`
- `storage.ts` — own localStorage key (e.g. `renewloop_admin_token`), same
  shape as Verdiq's `storage.ts`.
- `renewloop-auth.ts` — mirrors `verdiq-auth.ts`: `login()` posts to
  `${base}/auth/login`, but unlike Verdiq's `{success,data}` envelope, sbmint
  returns a plain `{ user, token }` body — the service adapts to that shape
  directly. Decodes the JWT client-side for `isAdmin`/`sub`/`email`, exposes
  `user`, `isAuthenticated`, `isAdmin`, `isTokenExpired()`, `getToken()`,
  `logout()`.
- `admin-api.ts` — typed client for `/admin/*`: `getUsers(search?, page?,
  limit?)`, `getUser(id)`, `deleteUser(id)`, `getCredentialStatus()`,
  `broadcastPush(title, body)`, `sendPushToUser(id, title, body)`.

### `src/app/core/models/renewloop/user.model.ts`
`UserRow`, `UserDetail`, `UsersPage` (rows + pagination meta),
`BroadcastResult`, `CredentialStatus` — matching the backend response shapes
above.

### `src/app/core/services/app-session.service.ts`
Add `ensureRenewloopSession()` (same not-expired short-circuit as
`ensureVerdiqSession`) and call `renewloopAuth.logout()` from
`clearVerdiqSession`'s sibling — rename/extend the existing shell-logout
cleanup to clear both service sessions.

### `src/app/core/guards/renewloop-session.guard.ts`
Same shape as `verdiq-session.guard.ts`.

### `src/app/core/interceptors/renewloop-auth.interceptor.ts`
Same shape as `verdiq-auth.interceptor.ts`: URL-prefix-gated on
`environment.renewloop.apiBaseUrl`, attaches the RenewLoop token only to
calls to that base.

### Pages, under `src/app/pages/apps/renewloop/`
- `users/users.ts` + `.html` — search input (debounced), paginated table
  (name, email, subscriptions count, device-token status badge, joined
  date), row click opens a detail view/modal, delete button with a confirm
  dialog (reusing the existing `ConfirmDeleteModal` shared component from
  Verdiq if it's generic enough, else a local equivalent), surfaces the
  `self_delete` backend error as a friendly message.
- `notifications/notifications.ts` + `.html` — modeled directly on
  `admin-push.component.ts`: credential-status banner, broadcast form
  (title/body, `confirm()` gate before sending, result summary
  `{sent, failed, staleRemoved, total}`), plus a "send to one user" form
  (user search/select + title/body), each wired to its own loading/error
  signal per the existing component's per-action state pattern.

### Routing (`app.routes.ts`)
Register both pages under `/apps/renewloop/...`, guarded by `authGuard` (shell
session) and `renewloopSessionGuard` (silent service-credential login),
following the existing Verdiq routes block layout exactly.

## Data flow

1. Admin logs into the shell (`AuthService`, backed by vamaha-backend — that
   login flow is unaffected by this work).
2. Navigating to `/apps/renewloop/*` triggers `renewloopSessionGuard`, which
   calls `AppSessionService.ensureRenewloopSession()` — silent login to
   sbmint as the seeded admin account if no valid token is cached.
3. `renewloopAuthInterceptor` attaches that token to every call whose URL
   starts with `environment.renewloop.apiBaseUrl`.
4. sbmint's `requireAuth` + `requireAdmin` validate the token and admin flag
   on every `/admin/*` request.

## Error handling

- Broadcast/single-send failures (FCM errors, missing device token) surface
  as inline UI errors, never silently swallowed — matching the existing
  `PushAdminService`/`admin-push.component.ts` convention of explicit error
  signals per action.
- Backend 403s any `/admin/*` call from a valid-but-non-admin JWT; 401 for a
  missing/invalid token (existing `requireAuth` behavior, unchanged).
- Self-delete is blocked server-side (`self_delete` error code) as the
  authoritative guard; the frontend may additionally disable the delete
  button for the signed-in service account's own row as a UX nicety, not a
  security boundary.

## Testing

- Backend: unit tests for the new `admin.service.js`, following the existing
  `*.test.js` sibling-file convention. Run through the project's existing
  test command.
- Frontend: implement, then manually test once in the browser (list/search/
  detail/delete, broadcast, single-user send, credential-status states) —
  no new Karma/Jasmine unit tests, consistent with this user's standing
  preference and with how the Verdiq/Vamaha admin pages were built.

## Out of scope (YAGNI, revisit only if asked)

- Promoting/demoting RenewLoop end users to admin (not applicable — separate
  populations).
- Multi-admin management UI (one seeded admin account is enough today).
- Scheduled/cron push campaigns (RenewLoop already has its own reminder cron
  in `jobs/reminder.job.js` for renewal nudges; this admin surface is for
  manual/ad-hoc sends only).
- Multi-device-per-user push tracking (sbmint's `user.model` has a single
  `deviceToken` field; broadening that is a separate change).
