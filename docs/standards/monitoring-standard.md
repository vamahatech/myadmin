# App Monitoring Standard (v1)

Status: adopted 2026-10-16 · Owner: Vamaha Studio · Applies to: every app managed in myadmin
(Vamaha site, EMI Planner, Verdiq, RenewLoop, and any app added later).

This standard says **what every app must let us see** in myadmin, **how each number is
defined**, and **what each backend must expose** so myadmin can build each monitoring module
once and reuse it for every app. The UI and code rules are in
[development-rules.md](development-rules.md).

---

## 1. Principles

1. **Each app's backend is the source of truth.** myadmin reads and acts through that app's
   own `/admin/*` API. Never copy users or events into a central store, and never let
   myadmin talk to an app's database directly. Admin actions must go through the same
   business rules the app uses.
2. **One contract, many backends.** The backends differ (NestJS/Postgres, Express/Postgres,
   Express/Mongo); the admin API shape does not. Section 5 is the contract.
3. **Define a metric once.** "Active user" means the same thing on every app's dashboard
   (section 3). If an app can't meet the definition, the module is hidden or labelled. It is
   never approximated silently.
4. **Privacy by default.** Collect structure, not content: no passwords, tokens, free text,
   message bodies or raw IPs in events or error reports (section 8).
5. **Enforced on the server.** Hiding a button is not access control. Every admin endpoint
   checks the admin's role, and every admin write is audited (section 7).
6. **Build only what an app can use.** An app declares which modules it supports (section 6).
   Payments, campaigns and advanced reports wait until an app needs them.

## 2. Modules, in priority order

| # | Module | What it answers | Priority |
|---|---|---|---|
| 1 | **Overview** | How big is the app, is it growing, is it healthy right now? | Essential |
| 2 | **Users** | Who are the users? Find one, see their status and history, act on the account. | Essential (account apps) |
| 3 | **Activity** | What happened, and who did it? (per user and app-wide) | Essential |
| 4 | **Analytics** | Which features are used, do people come back, where do they drop off? | Essential |
| 5 | **Errors** | What is breaking: crashes, failed requests, handled errors, by version/device? | Essential before and during testing |
| 6 | **Feedback** | What are users telling us, and is each item handled? | Essential before and during testing |
| 7 | **Notifications** | Push/email to everyone or a chosen group (exists: push-console, RenewLoop composer). | As needed |
| 8 | **Audit** | Which admin changed what, when, and why? | Required once any admin write exists |
| 9 | **Settings** | Admin roles, feature flags, app config. | Basic, later |

Module content (the minimum for "done"):

- **Overview:** KPI cards for total units, new in period, active (DAU/MAU) and inactive.
  Activity chart for 7/30 days. Errors: open count and the last 24h. Feedback: new count.
  Every delta compares against the previous equal-length period.
- **Users:** a searchable, sortable, paginated table. Detail panel with registration date,
  last active, status, devices and recent activity. Suspend/reactivate with a required reason,
  audited. CSV export (superadmin only, audited).
- **Activity:** a log filtered by user (search to pick one), action and time range. The
  focused-user view has a profile strip. (Reference: RenewLoop Activity.)
- **Analytics:** feature usage ranking, return rate/retention (D1/D7/D30), funnels for the
  app's key flows (sign-up → onboarding → first key action), onboarding completion rate.
- **Errors:** grouped issues (not raw rows) with count, first/last seen, affected versions
  and platforms, and a status workflow. Link out to the crash console for native crashes.
- **Feedback:** inbox with category, status workflow, app version/platform, and a link to
  the user when known.

## 3. Metric definitions (the same for every app)

**Unit**: what one "user" is, per app:

| Unit | Used when | Apps |
|---|---|---|
| `account` | the app has sign-in | Verdiq, RenewLoop |
| `install` | no accounts; an anonymous per-install id | EMI Planner |
| `visitor` | websites; a session or visitor id, never shown as "users" | Vamaha site |

Dashboards label the unit honestly: "Users" for accounts, "Installs" for installs,
"Visitors" for the site.

| Metric | Definition |
|---|---|
| **Registered / total** | Units that exist now (deleted accounts excluded). Installs: distinct install ids ever seen. |
| **New** | Units first created or first seen inside the period. |
| **Qualifying event** | A user-initiated event (open, sign-in, feature use). Not: push delivered, background jobs, admin actions. |
| **DAU / WAU / MAU** | Distinct units with at least one qualifying event in the UTC day, last 7 days, or last 30 days. |
| **Active (period)** | Distinct units with at least one qualifying event in the period. |
| **Inactive** | Registered units with no qualifying event in the last 30 days. |
| **Stickiness** | Average DAU over 30 days ÷ MAU. |
| **Retention Dn** | Of units first seen on day X, the share with a qualifying event on day X+n (n = 1, 7, 30). Report weekly cohorts. |
| **Funnel step rate** | Units reaching step k ÷ units reaching step k−1, within 7 days of step 1. |
| **Onboarding completion** | Units with `onboarding_completed` ÷ units that started onboarding, same cohort. |
| **Error rate** | Server: 5xx responses ÷ all responses. Client: units with ≥1 error ÷ active units. |

Rules:
- **Days are UTC** for bucketing on the server. myadmin shows times in the viewer's local
  zone, with the exact timestamp on hover.
- **Deltas** are `(current − previous) ÷ previous` over the previous equal period. When
  previous is 0, or either side is incomplete or sampled, show no percentage (show "new" or nothing).
- **Never estimate silently.** If a number comes from a sample or a cap, the API flags it
  (`capped: true`) and the UI shows "100+" or a note.
- Every summary response carries `generatedAt` so the UI can say how fresh the data is.

## 4. Data each app must record

### 4.1 Events

Envelope (every event, every app):

| Field | Rule |
|---|---|
| `eventId` | UUID made by the client; unique, so a retried batch can't double-count |
| `unitId` | `userId` (accounts) or `installId` (installs); null only for system/admin events |
| `event` | name from the app's catalog (below) |
| `props` | only keys allowlisted for that event; no PII, no free text |
| `appVersion`, `platform`, `osVersion` | needed for error and version breakdowns |
| `device` | short label for account/security events only ("Chrome on Windows") |
| `clientTs` / `createdAt` | client time if known; server time always |

**Naming:** `snake_case`, `object_action`, past tense, ≤ 40 characters
(`subscription_created`, `password_changed`). Existing names stay as they are (renaming breaks
history). Each app's catalog maps them to the canonical concepts below.

**Canonical concepts every app must emit** (the app-specific name goes in its catalog):

| Concept | EMI Planner | RenewLoop | Verdiq |
|---|---|---|---|
| app opened / session start | `app_open` | — (gap) | — (gap) |
| sign-up completed | n/a | `user_registered` | — (gap) |
| sign-in | n/a | `user_logged_in` | — (gap) |
| onboarding completed | `onboarding_complete` | — (gap) | — (gap) |
| core action | `calc_run`, `loan_tracked` | `subscription_created` | scan (`scan_events`, **no user id**: gap) |
| feedback submitted | `feedback_sent` | `feedback_submitted` | `app_feedback` row |

**Catalog:** every app keeps `docs/events.md` in its backend repo, listing each event, its
props, the concept it maps to, and whether it counts as qualifying. The server enforces an
allowlist: unknown events are dropped and unknown props stripped. EMI Planner's
`event-schemas.ts` already works this way; new apps follow that pattern.

### 4.2 User record (account apps)

`id, name?, email, createdAt, status (active | suspended | deleted), statusReason?,
emailVerified, lastActiveAt, knownDevices[] (label, firstSeenAt, lastSeenAt)`.
`lastActiveAt` is updated at most once per hour per user, so writes stay cheap.

### 4.3 Errors

One **issue** per fingerprint, not one row per occurrence:

| Field | Rule |
|---|---|
| `fingerprint` | hash of `source + kind + route/screen + status/exception type + top frame` |
| `source` | `server` or `client` |
| `kind` | `uncaught` (JS/process error nobody caught), `handled` (caught but worth knowing), `api_failure` (5xx / no response). Native `crash`/ANR is not stored here (see below). |
| `message` | scrubbed, ≤ 500 chars; no tokens, emails or request bodies |
| `route` / `screen`, `httpStatus` | where it happened |
| `appVersions[]`, `platforms[]` | sets, capped at 20 each |
| `count`, `affectedUnits`, `firstSeenAt`, `lastSeenAt` | increment on every occurrence |
| `status` | `new` → `investigating` → `resolved` / `ignored`; if a `resolved` issue occurs again it goes back to `new` (`regressed: true`) |

Sources:
- **Server:** the global error handler records every 5xx and unhandled rejection.
- **Client handled errors / failed requests:** `POST /errors` (batched, rate-limited per unit).
- **Native crashes / ANRs:** for Play-distributed Android apps, **Play Console's Android
  vitals** already collects these (from users who share diagnostics; about a day delayed).
  Don't duplicate them: the Errors page links to it (`AppTile.crashConsoleUrl`). Add
  Crashlytics only when an app needs real-time crash alerts, non-Play builds or iOS.
- **WebView apps (Capacitor/Ionic) need client capture regardless:** their screens are
  JavaScript, so most real failures are JS errors and failed requests. Play Console never
  sees those. The app installs a global `ErrorHandler` plus an HTTP interceptor (5xx and
  "no response while online"; 4xx are expected outcomes, not errors) that batch to
  `POST /errors`. Reports are deduped per session and capped, and the reporter's own request
  skips the interceptors, so a failing report can't loop. RenewLoop (`submint`) is the reference.
- **Retention is enforced by the database:** a TTL index on `lastSeenAt` (90 days).

### 4.4 Feedback

`id, unitId?, category (bug | suggestion | complaint | question | other), message,
rating?, appVersion, platform, contact? (only with consent), status (new | investigating |
resolved | closed), assignee?, resolutionNote?, createdAt, updatedAt`.
Vamaha's existing `NEW/READ/ARCHIVED` maps to `new / investigating / closed`.

### 4.5 Audit

`id, actor (admin id + email), action (resource.verb, e.g. user.suspend), target, reason?,
detail (before/after summary), createdAt`. Write it for **every** admin write, export and
bulk send. A failed audit write is logged loudly but does not fail the action. Verdiq's
`admin_audit_log` is the reference.

## 5. Admin API contract (each backend)

All under `/admin`, JSON, admin token required. Lists take `page` and `limit` (max 100) and
return `{ <resource>: [...], pagination: { page, limit, total, totalPages } }`. Dates are
ISO-8601 UTC. Errors are `{ errors: [message] }` with a proper status code.

| Endpoint | Module | Notes |
|---|---|---|
| `GET /admin/health` | all | `{ status, version, db }`, used by the myadmin home status dots |
| `GET /admin/overview?range=7d\|30d` | Overview | `{ unit, total, new, active, dau, mau, inactive, previous: {...}, activityByDay: [{date, events, activeUnits}], errors: {open, last24h}, feedback: {new}, generatedAt }` |
| `GET /admin/users` | Users | `search, sortBy, sortDir, status, page, limit` |
| `GET /admin/users/:id` | Users | user record (4.2) + `devices`, `lastActiveAt` |
| `POST /admin/users/:id/suspend` · `/reactivate` | Users | body `{ reason }` (required); audited; suspended users get 403 on every app route |
| `GET /admin/users/export` | Users | CSV, superadmin only, audited, explicit columns (never hashes or tokens) |
| `GET /admin/activity` | Activity | `userId, event, from, to, page, limit`; entries `{ id, event, user, deletedUser, device, details, createdAt }` |
| `GET /admin/analytics/features?from&to` | Analytics | `{ events: [{event, count, units}] }` |
| `GET /admin/analytics/retention?cohort=week` | Analytics | `{ cohorts: [{start, size, d1, d7, d30}] }` |
| `GET /admin/analytics/funnels/:key?from&to` | Analytics | `{ steps: [{event, units}] }`; funnel keys are defined in the app's catalog |
| `GET /admin/errors` · `PATCH /admin/errors/:id` | Errors | filter `status, source, kind, appVersion`; patch `{ status, note? }`, audited |
| `GET /admin/feedback` · `PATCH /admin/feedback/:id` | Feedback | filter `status, category`; patch `{ status, resolutionNote? }`, audited |
| `GET /admin/audit` | Audit | `actor, action, from, to` |

RenewLoop (`sbmint`) already serves `users`, `users/:id` and `activity` in this shape;
treat it as the reference implementation.

## 6. Capability flags (how myadmin knows what to show)

Each `AppTile` in `core/models/app-registry.model.ts` declares (planned field):

```ts
monitoring: {
  unit: 'account' | 'install' | 'visitor';
  modules: Array<'overview' | 'users' | 'activity' | 'analytics' | 'errors' | 'feedback' | 'audit'>;
  crashConsoleUrl?: string;   // Crashlytics / Sentry project link
}
```

The sidebar and the Overview hide modules an app doesn't support. A module goes into
`modules` only when its backend endpoint meets section 5.

## 7. Security and access

- **Admin identity must reach the app backend.** Today Verdiq and RenewLoop use a shared
  service credential, so their audit logs can't name which admin acted. Target: vamaha-backend
  issues the admin JWT (with `sub`, `email`, `role`), and each app backend verifies it (shared
  public key/JWKS). Then the service passwords go away. Until then, audit `actor` is recorded
  as the service account.
- **Roles:** `viewer` (read-only), `admin` (moderation, notifications, error/feedback status),
  `superadmin` (suspend, delete, export, roles, flags). The backend checks the role on every route.
- **No secrets in the frontend bundle.** The service passwords committed in
  `src/environments/environment.ts` must be rotated and removed (already a known issue).
- Rate-limit admin login; lock out after repeated failures; record admin sign-ins in the audit log.

## 8. Privacy and retention

- **Never record:** passwords, OTPs, tokens, payment details, message/feedback bodies inside
  events, search text, precise location, raw IP in events or errors. (The website's page-view
  tracker hashes IPs; app event streams store none.)
- **Allowed:** ids, event names, allowlisted props, app version, platform/OS, a coarse device
  label, country (only if the privacy policy says so).
- **Retention defaults:** sign-in/device events 90 days; other activity events 13 months;
  error issues 90 days after `lastSeenAt`; feedback 1 year after closing; audit log 2 years.
  Aggregates (daily counts) can be kept indefinitely.
- **Account deletion:** delete the account and personal records. Keep events but unlink them
  (`userId: null`, drop device), so totals stay right. That's the RenewLoop pattern.
- **Policy first:** any new kind of personal data needs a matching line in that app's
  privacy policy *before* it ships.

## 9. Where each app is today (2026-10-16)

| | Vamaha site | EMI Planner | Verdiq | RenewLoop |
|---|---|---|---|---|
| Backend | vamaha-backend (NestJS, Postgres) | vamaha-backend (`app_events`) | verdiq-backend (Express, Postgres) | sbmint (Express, Mongo) |
| Unit | visitor | install | account | account |
| Overview | partial (admin dashboard) | analytics page | overview page | KPI cards on Users |
| Users | n/a | n/a | admin users only | ✅ list, detail, devices |
| Activity | page views | ✅ events | scans with **no user id** | ✅ activity log |
| Analytics | page views by geo/device | ✅ allowlisted events | scan analytics | feature-usage counts (API only) |
| Errors | ❌ | ❌ | ❌ (stdout logs) | ✅ app + server issues, grouped |
| Crash reporting | n/a | ❌ | ❌ | Play Console (linked) |
| Feedback | ✅ (NEW/READ/ARCHIVED) | ✅ via vamaha-backend | ✅ `app_feedback` | ✅ in-app form + inbox |
| Audit | ❌ | ❌ | ✅ `admin_audit_log` | admin sends + status changes (activity log) |
| Suspend / export | n/a | n/a | ❌ | ❌ |
| Admin identity | shell JWT + roles | shell JWT | service credential | service credential |

## 10. Roadmap

| Phase | Goal | Work |
|---|---|---|
| **0: Foundation** | Make the standard usable | Capability flags (§6); shared module components (KPI row, filter toolbar, user picker, issue table); rotate and remove committed service passwords; `docs/events.md` per app |
| **1: See users** | Overview + Users + Activity everywhere it applies | RenewLoop: `/admin/overview`, `lastActiveAt`. Verdiq: add `user_id` to `scan_events`, sign-in events, users list/activity. EMI: overview from `app_events` (installs, DAU/MAU) |
| **2: See problems** | Errors + Feedback for every app | Error middleware + `app_errors` in all 3 backends; client `POST /errors`; Crashlytics in each mobile app; RenewLoop feedback; one shared Errors and Feedback page in myadmin |
| **3: Understand use** | Analytics + Audit | Feature ranking, retention cohorts, funnels from the catalogs; audit log in vamaha-backend and sbmint; Audit page |
| **4: Act safely** | Account control | Admin JWT across backends (§7), roles, suspend/reactivate, CSV export, feature flags |

Each phase ends with the [definition of done](development-rules.md#definition-of-done)
met for every app it touches.

**Progress (2026-10-16):** RenewLoop is the first app through the standard and the reference
implementation. Done there: Users (list, KPIs, detail panel with devices), Activity (log,
per-user focus), Feedback (in-app form, inbox, triage), Errors (app + server issues, regression,
90-day TTL, Play Console link). Still open there: `app_opened` + `lastActiveAt` (needed for
DAU/MAU), `/admin/overview`, analytics-event retention, suspend/export, real admin identity.
Tracked in `renewloop/docs/BACKLOG.md` › Monitoring. Next apps: Verdiq (needs `user_id` on
`scan_events`), then EMI Planner (overview from `app_events`).
