# Verdiq Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port verdiq-admin's 13 feature areas into `vamaha-www` as the Verdiq tile, authenticating to verdiq-backend via a silent service-credential login instead of a second manual login screen.

**Architecture:** Mechanical copy of verdiq-admin's feature page components (`.ts`/`.html`/`.sass`, content otherwise unchanged) into `pages/apps/verdiq/<area>/`, backed by a ported `AdminApi`/`VerdiqAuthService`/`StorageService` under `core/services/verdiq/` and models under `core/models/verdiq/`. A new `verdiqSessionGuard` + `AppSessionService.ensureVerdiqSession()` silently logs in to verdiq-backend before any Verdiq route activates; a new `verdiqAuthInterceptor` attaches that token only to verdiq-backend calls. Verdiq's shared global stylesheet is nested under a `.verdiq-app` selector (applied via a new optional `contentClass` field on `AppShellComponent`) to avoid colliding with Tailwind's own utility classes (notably `.grid`).

**Tech Stack:** Angular 21 (standalone components, signals), RxJS, Tailwind (shell only — verdiq pages keep their own scoped Sass), Fastify verdiq-backend (separate from vamaha-backend).

## Global Constraints

- Source repo for everything being ported: `C:\Users\Admin\Documents\verdiq\verdiq-admin\src\app` (read-only reference — never edit files there).
- Ported file content is copied verbatim except for the exact import-path rewrites specified per task. Do not "improve" ported code as part of this migration.
- After every task: `npx tsc --noEmit` must pass with no new errors.
- Before marking the whole plan done: `ng build` must succeed, and a fresh `ng serve` + hard browser refresh must be used to smoke-test (per this project's existing testing convention — no unit test framework here).
- Never commit real verdiq-backend service-account credentials — `environment.ts`'s `verdiq.serviceEmail`/`servicePassword` ship as placeholders; the user fills in real values locally out-of-band.
- Route registration order matters: `apps/verdiq/products/new` must be registered before `apps/verdiq/products/:id` (static segment doesn't win over a param automatically).

---

### Task 1: Verdiq environment config

**Files:**
- Modify: `src/environments/environment.ts`

**Interfaces:**
- Produces: `environment.verdiq.apiBaseUrl: string`, `environment.verdiq.serviceEmail: string`, `environment.verdiq.servicePassword: string` — consumed by Task 4 (AdminApi), Task 6 (VerdiqAuthService... actually consumed by Task 7's interceptor via apiBaseUrl, and Task 8's AppSessionService via serviceEmail/servicePassword).

- [ ] **Step 1: Add the verdiq block**

Current file:
```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'https://backend-usqv.onrender.com/api',
  siteUrl: 'https://vamaha.tech',
};
```

New file (this project has no `environment.prod.ts`/fileReplacements — `apiBaseUrl` above already points at the deployed vamaha-backend regardless of the `production` flag, so `verdiq.apiBaseUrl` follows the same existing convention and points at the deployed verdiq-backend directly):

```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'https://backend-usqv.onrender.com/api',
  siteUrl: 'https://vamaha.tech',
  verdiq: {
    apiBaseUrl: 'https://know-ingredients-backend.onrender.com',
    // Fill in a real verdiq-backend admin account before running locally —
    // never commit real values here.
    serviceEmail: 'REPLACE_WITH_SERVICE_ACCOUNT_EMAIL',
    servicePassword: 'REPLACE_WITH_SERVICE_ACCOUNT_PASSWORD',
  },
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/environments/environment.ts
git commit -m "Add verdiq-backend config to environment"
```

---

### Task 2: Port verdiq models

**Files:**
- Create: `src/app/core/models/verdiq/additive.model.ts`
- Create: `src/app/core/models/verdiq/admin-user.model.ts`
- Create: `src/app/core/models/verdiq/alternative.model.ts`
- Create: `src/app/core/models/verdiq/analytics.model.ts`
- Create: `src/app/core/models/verdiq/coverage.model.ts`
- Create: `src/app/core/models/verdiq/dashboard.model.ts`
- Create: `src/app/core/models/verdiq/double-standard.model.ts`
- Create: `src/app/core/models/verdiq/feedback.model.ts`
- Create: `src/app/core/models/verdiq/ingest.model.ts`
- Create: `src/app/core/models/verdiq/product.model.ts`
- Create: `src/app/core/models/verdiq/report.model.ts`
- Create: `src/app/core/models/verdiq/submission.model.ts`
- Create: `src/app/core/models/verdiq/user.model.ts`
- Create: `src/app/core/models/verdiq/verdict.model.ts`

**Interfaces:**
- Produces: every type these 14 files export (e.g. `DashboardMetrics`, `ProductPage`, `ProductRow`, `ProductDetail`, `ProductCreate`, `ProductUpdate`, `ProductQuery`, `SearchField`, `GapsReport`, `VerdictLevel`, `VerdictPage`, `VerdictRow`, `Additive`, `AdditiveList`, `SeedResult`, `DoubleStandardInput`, `DoubleStandardRow`, `Analytics`, `SubmissionList`, `Submission`, `SubmissionStatus`, `UsersReport`, `UserRow`, `AlternativeInput`, `AlternativeRow`, `IngestList`, `IngestRow`, `IngestStatus`, `ProductReportList`, `ProductReport`, `ReportStatus`, `AppFeedbackList`, `AppFeedback`, `FeedbackStatus`, `AdminUser`, `LoginResponse`, `Credentials`) — consumed by Task 4 (AdminApi), Task 3 (VerdiqAuthService uses `AdminUser`/`Credentials`/`LoginResponse`), and every feature task (12–14).

None of these files import anything outside their own file (verified: plain interface/type declarations), so this is a pure verbatim copy with no edits.

- [ ] **Step 1: Copy all 14 model files unchanged**

```bash
mkdir -p src/app/core/models/verdiq
SRC="/c/Users/Admin/Documents/verdiq/verdiq-admin/src/app/core/models"
DEST="src/app/core/models/verdiq"
cp "$SRC/additive.model.ts" "$SRC/admin-user.model.ts" "$SRC/alternative.model.ts" \
   "$SRC/analytics.model.ts" "$SRC/coverage.model.ts" "$SRC/dashboard.model.ts" \
   "$SRC/double-standard.model.ts" "$SRC/feedback.model.ts" "$SRC/ingest.model.ts" \
   "$SRC/product.model.ts" "$SRC/report.model.ts" "$SRC/submission.model.ts" \
   "$SRC/user.model.ts" "$SRC/verdict.model.ts" \
   "$DEST/"
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors (these files have no cross-references yet, so this should be a no-op check).

- [ ] **Step 3: Commit**

```bash
git add src/app/core/models/verdiq
git commit -m "Port verdiq data models"
```

---

### Task 3: Port StorageService + VerdiqAuthService

**Files:**
- Create: `src/app/core/services/verdiq/storage.ts`
- Create: `src/app/core/services/verdiq/verdiq-auth.ts`

**Interfaces:**
- Consumes: `AdminUser`, `Credentials`, `LoginResponse` from `../../models/verdiq/user.model` (Task 2), `environment.verdiq.apiBaseUrl` (Task 1).
- Produces: `StorageService` (`getToken(): string | null`, `setToken(token: string): void`, `clearToken(): void`), `VerdiqAuthService` (`user: Signal<AdminUser | null>`, `isAuthenticated: Signal<boolean>`, `login(creds: Credentials): Observable<LoginResponse>`, `logout(): void`, `getToken(): string | null`) — consumed by Task 6 (AppSessionService), Task 7 (interceptor), and the Users feature page (Task 14, reads `.user()`).

- [ ] **Step 1: Copy storage.ts unchanged**

```bash
mkdir -p src/app/core/services/verdiq
cp "/c/Users/Admin/Documents/verdiq/verdiq-admin/src/app/core/services/storage.ts" \
   src/app/core/services/verdiq/storage.ts
```

- [ ] **Step 2: Create verdiq-auth.ts**

Copy `/c/Users/Admin/Documents/verdiq/verdiq-admin/src/app/core/services/auth.ts` to
`src/app/core/services/verdiq/verdiq-auth.ts`, then rename the class and add a
`getToken()` accessor (needed by Task 7's interceptor, which has no reactive
context to read a signal from). Full resulting file:

```typescript
import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { StorageService } from './storage';
import { AdminUser, Credentials, LoginResponse } from '../../models/verdiq/user.model';

// Decodes the payload of a JWT without verifying it (verification is the
// server's job). We only read it to know is_admin/email for the UI + guards.
function decodeJwt(token: string): { sub: string; email: string; is_admin?: boolean } | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class VerdiqAuthService {
  private http = inject(HttpClient);
  private storage = inject(StorageService);
  private base = environment.verdiq.apiBaseUrl;

  // Reactive user state, hydrated from any stored token on construction.
  private readonly userSig = signal<AdminUser | null>(this.userFromStoredToken());
  readonly user = this.userSig.asReadonly();
  readonly isAuthenticated = computed(() => this.userSig() !== null);
  readonly isAdmin = computed(() => this.userSig()?.is_admin === true);

  login(creds: Credentials): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/auth/login`, creds).pipe(
      tap((res) => {
        this.storage.setToken(res.token);
        const claims = decodeJwt(res.token);
        this.userSig.set({
          id: res.user.id,
          email: res.user.email,
          is_admin: claims?.is_admin ?? res.user.is_admin,
        });
      }),
    );
  }

  logout(): void {
    this.storage.clearToken();
    this.userSig.set(null);
  }

  getToken(): string | null {
    return this.storage.getToken();
  }

  private userFromStoredToken(): AdminUser | null {
    const token = this.storage.getToken();
    if (!token) return null;
    const claims = decodeJwt(token);
    if (!claims) return null;
    return { id: claims.sub, email: claims.email, is_admin: claims.is_admin };
  }
}
```

(`forgotPassword`/`resetPassword` from the original are dropped — those flows
belong to verdiq-admin's own login pages, which are out of scope per the
design spec.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/core/services/verdiq/storage.ts src/app/core/services/verdiq/verdiq-auth.ts
git commit -m "Port verdiq storage + auth services"
```

---

### Task 4: Port AdminApi service

**Files:**
- Create: `src/app/core/services/verdiq/admin-api.ts`

**Interfaces:**
- Consumes: `environment.verdiq.apiBaseUrl` (Task 1), all 14 model exports (Task 2).
- Produces: `AdminApi` — the single shared HTTP client class every feature page (Tasks 12–14) injects for all verdiq-backend data calls.

- [ ] **Step 1: Copy the file**

```bash
cp "/c/Users/Admin/Documents/verdiq/verdiq-admin/src/app/core/services/admin-api.ts" \
   src/app/core/services/verdiq/admin-api.ts
```

- [ ] **Step 2: Rewrite its import block**

Old (top of file):
```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { DashboardMetrics } from '../models/dashboard.model';
import { ProductCreate, ProductDetail, ProductPage, ProductQuery, ProductUpdate } from '../models/product.model';
import { GapsReport } from '../models/coverage.model';
import { VerdictLevel, VerdictPage } from '../models/verdict.model';
import { Additive, AdditiveList, SeedResult } from '../models/additive.model';
import { DoubleStandardInput, DoubleStandardRow } from '../models/double-standard.model';
import { Analytics } from '../models/analytics.model';
import { SubmissionList } from '../models/submission.model';
import { UsersReport } from '../models/admin-user.model';
import { AlternativeInput, AlternativeRow } from '../models/alternative.model';
import { IngestList, IngestStatus } from '../models/ingest.model';
import { ProductReportList } from '../models/report.model';
import { AppFeedbackList } from '../models/feedback.model';
```

New:
```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { DashboardMetrics } from '../../models/verdiq/dashboard.model';
import { ProductCreate, ProductDetail, ProductPage, ProductQuery, ProductUpdate } from '../../models/verdiq/product.model';
import { GapsReport } from '../../models/verdiq/coverage.model';
import { VerdictLevel, VerdictPage } from '../../models/verdiq/verdict.model';
import { Additive, AdditiveList, SeedResult } from '../../models/verdiq/additive.model';
import { DoubleStandardInput, DoubleStandardRow } from '../../models/verdiq/double-standard.model';
import { Analytics } from '../../models/verdiq/analytics.model';
import { SubmissionList } from '../../models/verdiq/submission.model';
import { UsersReport } from '../../models/verdiq/admin-user.model';
import { AlternativeInput, AlternativeRow } from '../../models/verdiq/alternative.model';
import { IngestList, IngestStatus } from '../../models/verdiq/ingest.model';
import { ProductReportList } from '../../models/verdiq/report.model';
import { AppFeedbackList } from '../../models/verdiq/feedback.model';
```

Also change the base-URL line further down in the same file — find:
```typescript
  private base = environment.apiBaseUrl;
```
Replace with:
```typescript
  private base = environment.verdiq.apiBaseUrl;
```
(There is exactly one such line — it's the class field near the top of the `AdminApi` class body.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/core/services/verdiq/admin-api.ts
git commit -m "Port verdiq AdminApi service"
```

---

### Task 5: Port shared Modal + ConfirmDeleteModal components

**Files:**
- Create: `src/app/shared/components/verdiq/modal/modal.ts`
- Create: `src/app/shared/components/verdiq/modal/modal.html`
- Create: `src/app/shared/components/verdiq/modal/modal.sass`
- Create: `src/app/shared/components/verdiq/confirm-delete-modal/confirm-delete-modal.ts`
- Create: `src/app/shared/components/verdiq/confirm-delete-modal/confirm-delete-modal.html`
- Create: `src/app/shared/components/verdiq/confirm-delete-modal/confirm-delete-modal.sass`

**Interfaces:**
- Produces: `Modal`, `ConfirmDeleteModal` standalone components — consumed by Task 12 (Additives, Products) and Task 14 (Users).

Of verdiq-admin's 13 scaffolded shared components, only these two are actually
imported by any of the 13 migrated feature pages (verified: `grep -rn
"shared/components" features --include="*.ts"` matches only `modal/modal` and
`confirm-delete-modal/confirm-delete-modal`). The other 11
(`data-table`, `kpi-card`, `page-header`, `search-bar`, `stat-card`,
`status-badge`, `empty-state`, `loading-spinner`, `filter-panel`,
`confirm-dialog`) are unused scaffolding (same pattern as the `sidebar.ts`
stub found earlier in this codebase) and are not ported.

- [ ] **Step 1: Copy both components unchanged**

```bash
mkdir -p src/app/shared/components/verdiq/modal src/app/shared/components/verdiq/confirm-delete-modal
SRC="/c/Users/Admin/Documents/verdiq/verdiq-admin/src/app/shared/components"
cp "$SRC/modal/modal.ts" "$SRC/modal/modal.html" "$SRC/modal/modal.sass" \
   src/app/shared/components/verdiq/modal/
cp "$SRC/confirm-delete-modal/confirm-delete-modal.ts" \
   "$SRC/confirm-delete-modal/confirm-delete-modal.html" \
   "$SRC/confirm-delete-modal/confirm-delete-modal.sass" \
   src/app/shared/components/verdiq/confirm-delete-modal/
```

- [ ] **Step 2: Fix confirm-delete-modal's import of Modal**

`confirm-delete-modal.ts` imports its sibling `Modal` — since both were
copied into the same relative sibling arrangement (`verdiq/modal/` next to
`verdiq/confirm-delete-modal/`), the original relative import
`from '../modal/modal'` is already correct unchanged. No edit needed —
verify by reading the file after copy.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/shared/components/verdiq
git commit -m "Port verdiq Modal and ConfirmDeleteModal components"
```

---

### Task 6: AppShellComponent contentClass field

**Files:**
- Modify: `src/app/shared/components/app-shell/app-shell.component.ts`
- Modify: `src/app/shared/components/app-shell/app-shell.component.html`

**Interfaces:**
- Produces: `AppShellComponent.contentClass: string | undefined`, applied as a class on the shell's `<main>` element. Consumed by Task 11's `apps/verdiq` route (`data: { contentClass: 'verdiq-app' }`).

- [ ] **Step 1: Add the field**

In `app-shell.component.ts`, after the existing `navItems` line, add:

```typescript
  readonly navItems = this.route.snapshot.data['navItems'] as AppShellNavItem[];
  readonly contentClass = this.route.snapshot.data['contentClass'] as string | undefined;
```

- [ ] **Step 2: Apply it in the template**

In `app-shell.component.html`, change:

```html
  <main class="flex-1 min-w-0 md:h-screen md:overflow-y-auto">
```

to:

```html
  <main class="flex-1 min-w-0 md:h-screen md:overflow-y-auto" [class]="contentClass">
```

(Angular merges a dynamic `[class]` binding with the static `class` attribute
— existing tiles, whose route `data` has no `contentClass`, get `undefined`
bound, which Angular treats as no extra classes. No visual change for them.)

- [ ] **Step 3: Verify existing tiles are unaffected**

Run: `npx tsc --noEmit`, then `ng build`.
Expected: builds clean; manually confirm (via `ng serve`) the Vamaha and EMI
Planner tiles still render with no layout change.

- [ ] **Step 4: Commit**

```bash
git add src/app/shared/components/app-shell/app-shell.component.ts src/app/shared/components/app-shell/app-shell.component.html
git commit -m "Add optional contentClass hook to AppShellComponent"
```

---

### Task 7: Scope verdiq's global stylesheet under .verdiq-app

**Files:**
- Create: `src/app/pages/apps/verdiq/verdiq-globals.css`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: every CSS custom property (`--surface`, `--border`, `--text-muted`,
  `--primary`, `--ok`, `--caution`, `--avoid`, `--shadow`, `--bg`, `--text`,
  `--primary-ink`) and utility class (`.card`, `.btn`, `.btn-ghost`,
  `.btn-danger`, `.icon-btn`, `.icon-danger`, `.input`, `.page`,
  `.page-head`, `.muted`, `.panel`, `.state`, `.cols`, `.mini-table`,
  `.table-scroll`, `.grid`, `.pill`) scoped under `.verdiq-app` — every
  migrated feature page (Tasks 12–14) depends on these being present.

- [ ] **Step 1: Read the source file**

Read `/c/Users/Admin/Documents/verdiq/verdiq-admin/src/app/styles.sass` in full.

- [ ] **Step 2: Write the scoped copy**

Create `src/app/pages/apps/verdiq/verdiq-globals.css` containing the same
rules, translated from indented Sass to plain CSS, with every rule (including
the former `\:root` variable block) nested one level under `.verdiq-app`:

```css
.verdiq-app {
  --bg: #f6f7f9;
  --surface: #ffffff;
  --border: #e3e6ea;
  --text: #1a1f26;
  --text-muted: #667085;
  --primary: #2563eb;
  --primary-ink: #ffffff;
  --ok: #16a34a;
  --caution: #d97706;
  --avoid: #dc2626;
  --shadow: 0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.1);

  background: var(--bg);
  color: var(--text);
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.verdiq-app a {
  color: var(--primary);
  text-decoration: none;
}

.verdiq-app .card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
}

.verdiq-app .btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .5rem;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: .55rem 1rem;
  font-size: .9rem;
  font-weight: 600;
  cursor: pointer;
  background: var(--primary);
  color: var(--primary-ink);
}

.verdiq-app .btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.verdiq-app .btn-ghost {
  background: transparent;
  color: var(--text);
  border-color: var(--border);
}

.verdiq-app .btn-danger {
  background: var(--avoid);
  color: #fff;
}

.verdiq-app .icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: .35rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  line-height: 0;
}

.verdiq-app .icon-btn:hover:not(:disabled) {
  background: var(--bg);
}

.verdiq-app .icon-btn:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.verdiq-app .icon-danger {
  color: var(--avoid);
}

.verdiq-app .input {
  width: 100%;
  padding: .55rem .7rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: .9rem;
  background: var(--surface);
  color: var(--text);
}

.verdiq-app .page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.verdiq-app .page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.verdiq-app .page-head h1 {
  margin: 0 0 .2rem;
  font-size: 1.5rem;
}

.verdiq-app .muted {
  color: var(--text-muted);
  margin: 0;
  font-size: .9rem;
}

.verdiq-app .panel {
  padding: 1.25rem;
}

.verdiq-app .panel h2 {
  margin: 0 0 .3rem;
  font-size: 1.05rem;
}

.verdiq-app .state {
  padding: 1.25rem;
  color: var(--text-muted);
}

.verdiq-app .state.error {
  color: var(--avoid);
  background: #fef2f2;
  border-color: #fecaca;
}

.verdiq-app .cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

@media (max-width: 900px) {
  .verdiq-app .cols {
    grid-template-columns: 1fr;
  }
}

.verdiq-app .mini-table {
  width: 100%;
  border-collapse: collapse;
  font-size: .85rem;
  margin-top: .6rem;
}

.verdiq-app .mini-table th {
  text-align: left;
  padding: .5rem .6rem;
  border-bottom: 1px solid var(--border);
  color: var(--text-muted);
  font-size: .72rem;
  text-transform: uppercase;
  letter-spacing: .04em;
}

.verdiq-app .mini-table td {
  padding: .5rem .6rem;
  border-bottom: 1px solid #f0f2f5;
}

.verdiq-app .mini-table .num {
  text-align: right;
}

.verdiq-app .table-scroll {
  overflow-x: auto;
}

.verdiq-app .grid {
  width: 100%;
  border-collapse: collapse;
  font-size: .88rem;
}

.verdiq-app .grid th {
  text-align: left;
  padding: .7rem .9rem;
  border-bottom: 1px solid var(--border);
  color: var(--text-muted);
  font-size: .75rem;
  text-transform: uppercase;
  letter-spacing: .04em;
}

.verdiq-app .grid td {
  padding: .65rem .9rem;
  border-bottom: 1px solid #f0f2f5;
  vertical-align: top;
}

.verdiq-app .grid tbody tr:hover {
  background: #fafbfc;
}

.verdiq-app .grid .strong {
  font-weight: 600;
}

.verdiq-app .grid .mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: .82rem;
  color: var(--text-muted);
}

.verdiq-app .grid .empty {
  text-align: center;
  padding: 1.5rem;
  color: var(--text-muted);
}

.verdiq-app .pill {
  display: inline-block;
  padding: .12rem .5rem;
  border-radius: 999px;
  font-size: .74rem;
  font-weight: 600;
}

.verdiq-app .pill.yes {
  background: #ecfdf3;
  color: var(--ok);
}

.verdiq-app .pill.no {
  background: #fef3f2;
  color: var(--avoid);
}

.verdiq-app .pill.neutral {
  background: #eef2f7;
  color: var(--text-muted);
}
```

(The original's `*` box-sizing and `html, body` resets are dropped — those are
already handled globally by vamaha-www's own `styles.css`/Tailwind base, and
re-declaring them here would have no scoping benefit since they target
elements outside `.verdiq-app`.)

- [ ] **Step 3: Import it globally**

In `src/styles.css`, add an import alongside the existing one for
`styles/colors.css` (read the file first to find the exact existing import
line and add the new one immediately after it):

```css
@import './app/pages/apps/verdiq/verdiq-globals.css';
```

- [ ] **Step 4: Verify**

Run: `ng build`.
Expected: builds clean (no CSS syntax errors).

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/apps/verdiq/verdiq-globals.css src/styles.css
git commit -m "Scope verdiq's shared stylesheet under .verdiq-app"
```

---

### Task 8: verdiqAuthInterceptor

**Files:**
- Create: `src/app/core/interceptors/verdiq-auth.interceptor.ts`
- Modify: `src/app/app.config.ts`

**Interfaces:**
- Consumes: `VerdiqAuthService.getToken()` (Task 3), `environment.verdiq.apiBaseUrl` (Task 1).
- Produces: `verdiqAuthInterceptor: HttpInterceptorFn`, registered in `provideHttpClient`.

- [ ] **Step 1: Create the interceptor**

```typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { VerdiqAuthService } from '../services/verdiq/verdiq-auth';
import { environment } from '../../../environments/environment';

/**
 * Attaches the verdiq-backend JWT (obtained via silent service-credential
 * login, see AppSessionService) to verdiq-backend calls only. Mirrors
 * authInterceptor's URL-prefix gating so vamaha-backend calls are untouched.
 */
export const verdiqAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(VerdiqAuthService).getToken();
  if (token && req.url.startsWith(environment.verdiq.apiBaseUrl)) {
    return next(
      req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }),
    );
  }
  return next(req);
};
```

- [ ] **Step 2: Register it**

In `src/app/app.config.ts`, change:

```typescript
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideRouter(routes),
  ],
};
```

to:

```typescript
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { verdiqAuthInterceptor } from './core/interceptors/verdiq-auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, verdiqAuthInterceptor])),
    provideRouter(routes),
  ],
};
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/core/interceptors/verdiq-auth.interceptor.ts src/app/app.config.ts
git commit -m "Add verdiq-backend auth interceptor"
```

---

### Task 9: AppSessionService.ensureVerdiqSession()

**Files:**
- Modify: `src/app/core/services/app-session.service.ts`

**Interfaces:**
- Consumes: `VerdiqAuthService.getToken()`/`.login()` (Task 3), `environment.verdiq.serviceEmail`/`servicePassword` (Task 1).
- Produces: `AppSessionService.ensureVerdiqSession(): Promise<void>` — consumed by Task 10's `verdiqSessionGuard`.

- [ ] **Step 1: Replace the stub with a real implementation**

Current file:
```typescript
import { Injectable } from '@angular/core';

/**
 * Future extension point: an app whose backend differs from vamaha-backend
 * (e.g. a future Verdiq tile) would use this to perform a one-time silent
 * login per session and cache the resulting token, with an app-scoped
 * interceptor attaching it only to that backend's requests. Not exercised
 * yet — every current tile shares vamaha-backend and reuses the shell's
 * AuthService token directly.
 */
@Injectable({ providedIn: 'root' })
export class AppSessionService {
  private readonly tokens = new Map<string, string>();

  getToken(appId: string): string | undefined {
    return this.tokens.get(appId);
  }

  setToken(appId: string, token: string): void {
    this.tokens.set(appId, token);
  }
}
```

New file:
```typescript
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { VerdiqAuthService } from './verdiq/verdiq-auth';

/**
 * Cross-backend silent-login for apps whose backend differs from
 * vamaha-backend (currently just Verdiq). VerdiqAuthService already persists
 * its token via StorageService, so this only logs in when no token exists
 * yet this browser session.
 */
@Injectable({ providedIn: 'root' })
export class AppSessionService {
  private readonly verdiqAuth = inject(VerdiqAuthService);

  async ensureVerdiqSession(): Promise<void> {
    if (this.verdiqAuth.getToken()) return;
    await firstValueFrom(
      this.verdiqAuth.login({
        email: environment.verdiq.serviceEmail,
        password: environment.verdiq.servicePassword,
      }),
    );
  }
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/services/app-session.service.ts
git commit -m "Implement silent verdiq-backend session login"
```

---

### Task 10: verdiqSessionGuard

**Files:**
- Create: `src/app/core/guards/verdiq-session.guard.ts`

**Interfaces:**
- Consumes: `AppSessionService.ensureVerdiqSession()` (Task 9).
- Produces: `verdiqSessionGuard: CanActivateFn` — consumed by Task 11's `apps/verdiq` route.

- [ ] **Step 1: Create the guard**

```typescript
import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AppSessionService } from '../services/app-session.service';

/**
 * Ensures a verdiq-backend session exists before any apps/verdiq/* route
 * activates, so every ported feature component can assume a valid token is
 * already in place when it fires its first HTTP call.
 */
export const verdiqSessionGuard: CanActivateFn = async () => {
  await inject(AppSessionService).ensureVerdiqSession();
  return true;
};
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/guards/verdiq-session.guard.ts
git commit -m "Add verdiq-backend session guard"
```

---

### Task 11: Wire the apps/verdiq route skeleton + update APP_REGISTRY

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/core/models/app-registry.model.ts`

**Interfaces:**
- Consumes: `authGuard` (existing), `verdiqSessionGuard` (Task 10), `AppShellComponent` (existing, + Task 6's `contentClass`).
- Produces: the `apps/verdiq` route tree that Tasks 12–14 append children to.

- [ ] **Step 1: Add the parent route**

In `src/app/app.routes.ts`, add this block before the trailing
`{ path: '**', redirectTo: '' }` line:

```typescript
  {
    path: 'apps/verdiq',
    canActivate: [authGuard, verdiqSessionGuard],
    loadComponent: () =>
      import('./shared/components/app-shell/app-shell.component').then(
        m => m.AppShellComponent,
      ),
    data: {
      appName: 'Verdiq',
      appIcon: '🧩',
      contentClass: 'verdiq-app',
      navItems: [
        { label: 'Overview', icon: '📊', path: 'overview' },
        { label: 'Products', icon: '📦', path: 'products' },
        { label: 'Coverage & gaps', icon: '🎯', path: 'coverage' },
        { label: 'Verdict review', icon: '⚖️', path: 'verdicts' },
        { label: 'Additives (INS)', icon: '🧪', path: 'additives' },
        { label: 'Double standards', icon: '🌍', path: 'double-standards' },
        { label: 'Alternatives', icon: '🔄', path: 'alternatives' },
        { label: 'Analytics', icon: '📈', path: 'analytics' },
        { label: 'Submissions', icon: '📥', path: 'submissions' },
        { label: 'Reports', icon: '🚩', path: 'reports' },
        { label: 'Feedback', icon: '💬', path: 'feedback' },
        { label: 'Ingest review', icon: '🛒', path: 'ingest' },
        { label: 'Users & testers', icon: '👨‍👩‍👧', path: 'users' },
      ],
    },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
    ],
  },
```

Add the import for `verdiqSessionGuard` at the top of the file, alongside the
existing `authGuard` import:

```typescript
import { verdiqSessionGuard } from './core/guards/verdiq-session.guard';
```

- [ ] **Step 2: Update APP_REGISTRY**

In `src/app/core/models/app-registry.model.ts`, change the verdiq entry's
route (it previously pointed at a non-existent analytics-only placeholder;
now it should land on Overview like every other tile) and update the
comment above the interface, which is now stale:

Old:
```typescript
export interface AppTile {
  id: string;
  name: string;
  icon: string;
  accentColor: string;
  route: string;
  /** One line, shown under the app name on the tile-home ledger. */
  tagline: string;
  /** How this app authenticates: 'shell' reuses the shell's AuthService token
   *  directly. A future cross-backend app (e.g. Verdiq) would add a
   *  'service-credential' mode handled by AppSessionService. */
  authMode: 'shell';
}
```
```typescript
  {
    id: 'verdiq',
    name: 'Verdiq',
    icon: '🧩',
    accentColor: 'var(--color-blue)',
    route: '/apps/verdiq/analytics',
    tagline: 'Usage analytics for the Verdiq app.',
    authMode: 'shell',
  },
```

New:
```typescript
export interface AppTile {
  id: string;
  name: string;
  icon: string;
  accentColor: string;
  route: string;
  /** One line, shown under the app name on the tile-home ledger. */
  tagline: string;
  /** How this app authenticates: 'shell' reuses the shell's AuthService token
   *  directly; 'service-credential' silently logs in to that app's own
   *  backend via AppSessionService (see Verdiq below). */
  authMode: 'shell' | 'service-credential';
}
```
```typescript
  {
    id: 'verdiq',
    name: 'Verdiq',
    icon: '🧩',
    accentColor: 'var(--color-blue)',
    route: '/apps/verdiq',
    tagline: 'Child food safety verdicts, products, and moderation.',
    authMode: 'service-credential',
  },
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`, then `ng build`.
Expected: builds clean. Manually check (`ng serve`) that clicking the Verdiq
tile navigates to `/apps/verdiq/overview` and shows the shell chrome with all
13 nav items (their target pages don't exist yet — expect a blank
`<router-outlet>` or a "cannot match" state until Task 12 lands; that's
expected at this point in the plan).

- [ ] **Step 4: Commit**

```bash
git add src/app/app.routes.ts src/app/core/models/app-registry.model.ts
git commit -m "Wire apps/verdiq route skeleton"
```

---

### Task 12: Migrate Overview, Products, Coverage, Verdict review

**Files:**
- Create: `src/app/pages/apps/verdiq/overview/overview.ts` (+`.html`, `.sass`)
- Create: `src/app/pages/apps/verdiq/products/products-list.ts` (+`.html`, `.sass`)
- Create: `src/app/pages/apps/verdiq/products/product-detail.ts` (+`.html`, `.sass`)
- Create: `src/app/pages/apps/verdiq/coverage/coverage.ts` (+`.html`, `.sass`)
- Create: `src/app/pages/apps/verdiq/verdicts/verdict-review.ts` (+`.html`, `.sass`)
- Modify: `src/app/app.routes.ts`

**Interfaces:**
- Consumes: `AdminApi` (Task 4), `DashboardMetrics`/`ProductPage`/`ProductRow`/`ProductDetail as ProductDetailModel`/`ProductCreate`/`ProductUpdate`/`SearchField`/`GapsReport`/`VerdictLevel`/`VerdictPage`/`VerdictRow` (Task 2), `ConfirmDeleteModal` (Task 5).
- Produces: `Overview`, `ProductsList`, `ProductDetail`, `Coverage`, `VerdictReview` standalone components, registered as route children.

Every `.html`/`.sass` file in this task is copied byte-for-byte unchanged.
Every `.ts` file gets the same mechanical import rewrite: prepend `verdiq/`
to the path segment after `core/services/`, `core/models/`, and
`shared/components/` (the `../` depth is identical between source and
destination — both are 4 levels deep from `app/` — so only that one segment
changes).

- [ ] **Step 1: Copy all html/sass files unchanged**

```bash
SRC="/c/Users/Admin/Documents/verdiq/verdiq-admin/src/app/features"
DEST="src/app/pages/apps/verdiq"
mkdir -p "$DEST/overview" "$DEST/products" "$DEST/coverage" "$DEST/verdicts"

cp "$SRC/dashboard/pages/overview/overview.html" "$SRC/dashboard/pages/overview/overview.sass" "$DEST/overview/"
cp "$SRC/products/pages/products-list/products-list.html" "$SRC/products/pages/products-list/products-list.sass" "$DEST/products/"
cp "$SRC/products/pages/product-detail/product-detail.html" "$SRC/products/pages/product-detail/product-detail.sass" "$DEST/products/"
cp "$SRC/coverage/pages/coverage/coverage.html" "$SRC/coverage/pages/coverage/coverage.sass" "$DEST/coverage/"
cp "$SRC/verdicts/pages/verdict-review/verdict-review.html" "$SRC/verdicts/pages/verdict-review/verdict-review.sass" "$DEST/verdicts/"
```

- [ ] **Step 2: Copy overview.ts and rewrite its imports**

```bash
cp "$SRC/dashboard/pages/overview/overview.ts" "$DEST/overview/"
```

Old imports:
```typescript
import { AdminApi } from '../../../../core/services/admin-api';
import { DashboardMetrics } from '../../../../core/models/dashboard.model';
```
New imports (the `../` depth is unchanged — `pages/apps/verdiq/overview` is
4 segments under `app/`, same as the source's `features/dashboard/pages/overview`
— only `verdiq/` is inserted):
```typescript
import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { DashboardMetrics } from '../../../../core/models/verdiq/dashboard.model';
```

- [ ] **Step 3: Copy products-list.ts and product-detail.ts, rewrite imports**

```bash
cp "$SRC/products/pages/products-list/products-list.ts" "$DEST/products/"
cp "$SRC/products/pages/product-detail/product-detail.ts" "$DEST/products/"
```

`products-list.ts` — old:
```typescript
import { AdminApi } from '../../../../core/services/admin-api';
import { ProductPage, ProductRow, SearchField } from '../../../../core/models/product.model';
import { ConfirmDeleteModal } from '../../../../shared/components/confirm-delete-modal/confirm-delete-modal';
```
new:
```typescript
import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { ProductPage, ProductRow, SearchField } from '../../../../core/models/verdiq/product.model';
import { ConfirmDeleteModal } from '../../../../shared/components/verdiq/confirm-delete-modal/confirm-delete-modal';
```

`product-detail.ts` — old:
```typescript
import { AdminApi } from '../../../../core/services/admin-api';
import {
  ProductDetail as ProductDetailModel,
  ProductCreate,
  ProductUpdate,
} from '../../../../core/models/product.model';
```
new:
```typescript
import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import {
  ProductDetail as ProductDetailModel,
  ProductCreate,
  ProductUpdate,
} from '../../../../core/models/verdiq/product.model';
```

- [ ] **Step 4: Copy coverage.ts and verdict-review.ts, rewrite imports**

```bash
cp "$SRC/coverage/pages/coverage/coverage.ts" "$DEST/coverage/"
cp "$SRC/verdicts/pages/verdict-review/verdict-review.ts" "$DEST/verdicts/"
```

`coverage.ts` — old:
```typescript
import { AdminApi } from '../../../../core/services/admin-api';
import { GapsReport } from '../../../../core/models/coverage.model';
```
new:
```typescript
import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { GapsReport } from '../../../../core/models/verdiq/coverage.model';
```

`verdict-review.ts` — old:
```typescript
import { AdminApi } from '../../../../core/services/admin-api';
import { VerdictLevel, VerdictPage, VerdictRow } from '../../../../core/models/verdict.model';
```
new:
```typescript
import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { VerdictLevel, VerdictPage, VerdictRow } from '../../../../core/models/verdiq/verdict.model';
```

- [ ] **Step 5: Register the routes**

In `src/app/app.routes.ts`, replace the `apps/verdiq` route's children array
(currently just the redirect from Task 11) with:

```typescript
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        loadComponent: () =>
          import('./pages/apps/verdiq/overview/overview').then(m => m.Overview),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./pages/apps/verdiq/products/products-list').then(m => m.ProductsList),
      },
      {
        // Must precede 'products/:id' — static segments don't win over
        // parameterized ones by registration order alone.
        path: 'products/new',
        loadComponent: () =>
          import('./pages/apps/verdiq/products/product-detail').then(m => m.ProductDetail),
      },
      {
        path: 'products/:id',
        loadComponent: () =>
          import('./pages/apps/verdiq/products/product-detail').then(m => m.ProductDetail),
      },
      {
        path: 'coverage',
        loadComponent: () =>
          import('./pages/apps/verdiq/coverage/coverage').then(m => m.Coverage),
      },
      {
        path: 'verdicts',
        loadComponent: () =>
          import('./pages/apps/verdiq/verdicts/verdict-review').then(m => m.VerdictReview),
      },
    ],
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`, then `ng build`.
Expected: builds clean. Manually check (`ng serve`) that Overview, Products
(list, new, and an existing `:id`), Coverage, and Verdict review all render
inside the `.verdiq-app`-scoped styling with data loading from verdiq-backend
(confirms the silent login + interceptor from Tasks 8–10 work end-to-end).

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/apps/verdiq/overview src/app/pages/apps/verdiq/products src/app/pages/apps/verdiq/coverage src/app/pages/apps/verdiq/verdicts src/app/app.routes.ts
git commit -m "Migrate Overview, Products, Coverage, Verdict review"
```

---

### Task 13: Migrate Additives, Double standards, Alternatives, Analytics

**Files:**
- Create: `src/app/pages/apps/verdiq/additives/additives.ts` (+`.html`, `.sass`)
- Create: `src/app/pages/apps/verdiq/double-standards/double-standards.ts` (+`.html`, `.sass`)
- Create: `src/app/pages/apps/verdiq/alternatives/alternatives.ts` (+`.html`, `.sass`)
- Create: `src/app/pages/apps/verdiq/analytics/analytics.ts` (+`.html`, `.sass`)
- Modify: `src/app/app.routes.ts`

**Interfaces:**
- Consumes: `AdminApi` (Task 4), `Additive`/`AdditiveList`/`SeedResult`/`DoubleStandardInput`/`DoubleStandardRow`/`AlternativeInput`/`AlternativeRow`/`Analytics as AnalyticsData` (Task 2), `Modal` (Task 5).
- Produces: `Additives`, `DoubleStandards`, `Alternatives`, `Analytics` standalone components, registered as route children.

Same mechanical rule as Task 12: copy `.html`/`.sass` unchanged, copy `.ts`
and insert `verdiq/` into the `core/services/`, `core/models/`, and
`shared/components/` import paths (dot-count unchanged, both source and
destination are 4 segments deep).

- [ ] **Step 1: Copy all html/sass files unchanged**

```bash
SRC="/c/Users/Admin/Documents/verdiq/verdiq-admin/src/app/features"
DEST="src/app/pages/apps/verdiq"
mkdir -p "$DEST/additives" "$DEST/double-standards" "$DEST/alternatives" "$DEST/analytics"

cp "$SRC/additives/pages/additives/additives.html" "$SRC/additives/pages/additives/additives.sass" "$DEST/additives/"
cp "$SRC/double-standards/pages/double-standards/double-standards.html" "$SRC/double-standards/pages/double-standards/double-standards.sass" "$DEST/double-standards/"
cp "$SRC/alternatives/pages/alternatives/alternatives.html" "$SRC/alternatives/pages/alternatives/alternatives.sass" "$DEST/alternatives/"
cp "$SRC/analytics/pages/analytics/analytics.html" "$SRC/analytics/pages/analytics/analytics.sass" "$DEST/analytics/"
```

- [ ] **Step 2: Copy additives.ts and rewrite imports**

```bash
cp "$SRC/additives/pages/additives/additives.ts" "$DEST/additives/"
```

Old:
```typescript
import { AdminApi } from '../../../../core/services/admin-api';
import { Additive } from '../../../../core/models/additive.model';
import { Modal } from '../../../../shared/components/modal/modal';
```
New:
```typescript
import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { Additive } from '../../../../core/models/verdiq/additive.model';
import { Modal } from '../../../../shared/components/verdiq/modal/modal';
```

- [ ] **Step 3: Copy double-standards.ts and rewrite imports**

```bash
cp "$SRC/double-standards/pages/double-standards/double-standards.ts" "$DEST/double-standards/"
```

Old:
```typescript
import { AdminApi } from '../../../../core/services/admin-api';
import {
  DoubleStandardInput,
  DoubleStandardRow,
} from '../../../../core/models/double-standard.model';
```
New:
```typescript
import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import {
  DoubleStandardInput,
  DoubleStandardRow,
} from '../../../../core/models/verdiq/double-standard.model';
```

- [ ] **Step 4: Copy alternatives.ts and analytics.ts, rewrite imports**

```bash
cp "$SRC/alternatives/pages/alternatives/alternatives.ts" "$DEST/alternatives/"
cp "$SRC/analytics/pages/analytics/analytics.ts" "$DEST/analytics/"
```

`alternatives.ts` — old:
```typescript
import { AdminApi } from '../../../../core/services/admin-api';
import { AlternativeInput, AlternativeRow } from '../../../../core/models/alternative.model';
```
new:
```typescript
import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { AlternativeInput, AlternativeRow } from '../../../../core/models/verdiq/alternative.model';
```

`analytics.ts` — old:
```typescript
import { AdminApi } from '../../../../core/services/admin-api';
import { Analytics as AnalyticsData } from '../../../../core/models/analytics.model';
```
new:
```typescript
import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { Analytics as AnalyticsData } from '../../../../core/models/verdiq/analytics.model';
```

- [ ] **Step 5: Register the routes**

In `src/app/app.routes.ts`, append to the `apps/verdiq` route's `children`
array (after `verdicts`):

```typescript
      {
        path: 'additives',
        loadComponent: () =>
          import('./pages/apps/verdiq/additives/additives').then(m => m.Additives),
      },
      {
        path: 'double-standards',
        loadComponent: () =>
          import('./pages/apps/verdiq/double-standards/double-standards').then(m => m.DoubleStandards),
      },
      {
        path: 'alternatives',
        loadComponent: () =>
          import('./pages/apps/verdiq/alternatives/alternatives').then(m => m.Alternatives),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./pages/apps/verdiq/analytics/analytics').then(m => m.Analytics),
      },
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`, then `ng build`.
Expected: builds clean. Manually check (`ng serve`) all four pages render
and load data.

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/apps/verdiq/additives src/app/pages/apps/verdiq/double-standards src/app/pages/apps/verdiq/alternatives src/app/pages/apps/verdiq/analytics src/app/app.routes.ts
git commit -m "Migrate Additives, Double standards, Alternatives, Analytics"
```

---

### Task 14: Migrate Submissions, Reports, Feedback, Ingest review, Users & testers

**Files:**
- Create: `src/app/pages/apps/verdiq/submissions/submissions.ts` (+`.html`, `.sass`)
- Create: `src/app/pages/apps/verdiq/reports/reports.ts` (+`.html`, `.sass`)
- Create: `src/app/pages/apps/verdiq/feedback/feedback.ts` (+`.html`, `.sass`)
- Create: `src/app/pages/apps/verdiq/ingest/ingest.ts` (+`.html`, `.sass`)
- Create: `src/app/pages/apps/verdiq/users/users.ts` (+`.html`, `.sass`)
- Modify: `src/app/app.routes.ts`

**Interfaces:**
- Consumes: `AdminApi` (Task 4), `Submission`/`SubmissionList`/`SubmissionStatus`/`ProductReport`/`ProductReportList`/`ReportStatus`/`AppFeedback`/`AppFeedbackList`/`FeedbackStatus`/`IngestList`/`IngestRow`/`IngestStatus`/`UserRow`/`UsersReport` (Task 2), `VerdiqAuthService` (Task 3, Users only), `Modal`/`ConfirmDeleteModal` (Task 5, Users only).
- Produces: `Submissions`, `Reports`, `Feedback`, `Ingest`, `Users` standalone components, registered as route children — this completes the full 13-item nav.

Same mechanical rule as Tasks 12–13.

- [ ] **Step 1: Copy all html/sass files unchanged**

```bash
SRC="/c/Users/Admin/Documents/verdiq/verdiq-admin/src/app/features"
DEST="src/app/pages/apps/verdiq"
mkdir -p "$DEST/submissions" "$DEST/reports" "$DEST/feedback" "$DEST/ingest" "$DEST/users"

cp "$SRC/submissions/pages/submissions/submissions.html" "$SRC/submissions/pages/submissions/submissions.sass" "$DEST/submissions/"
cp "$SRC/reports/pages/reports/reports.html" "$SRC/reports/pages/reports/reports.sass" "$DEST/reports/"
cp "$SRC/feedback/pages/feedback/feedback.html" "$SRC/feedback/pages/feedback/feedback.sass" "$DEST/feedback/"
cp "$SRC/ingest/pages/ingest/ingest.html" "$SRC/ingest/pages/ingest/ingest.sass" "$DEST/ingest/"
cp "$SRC/users/pages/users/users.html" "$SRC/users/pages/users/users.sass" "$DEST/users/"
```

- [ ] **Step 2: Copy submissions.ts and reports.ts, rewrite imports**

```bash
cp "$SRC/submissions/pages/submissions/submissions.ts" "$DEST/submissions/"
cp "$SRC/reports/pages/reports/reports.ts" "$DEST/reports/"
```

`submissions.ts` — old:
```typescript
import { AdminApi } from '../../../../core/services/admin-api';
import { Submission, SubmissionList, SubmissionStatus } from '../../../../core/models/submission.model';
```
new:
```typescript
import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { Submission, SubmissionList, SubmissionStatus } from '../../../../core/models/verdiq/submission.model';
```

`reports.ts` — old:
```typescript
import { AdminApi } from '../../../../core/services/admin-api';
import { ProductReport, ProductReportList, ReportStatus } from '../../../../core/models/report.model';
```
new:
```typescript
import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { ProductReport, ProductReportList, ReportStatus } from '../../../../core/models/verdiq/report.model';
```

- [ ] **Step 3: Copy feedback.ts and ingest.ts, rewrite imports**

```bash
cp "$SRC/feedback/pages/feedback/feedback.ts" "$DEST/feedback/"
cp "$SRC/ingest/pages/ingest/ingest.ts" "$DEST/ingest/"
```

`feedback.ts` — old:
```typescript
import { AdminApi } from '../../../../core/services/admin-api';
import { AppFeedback, AppFeedbackList, FeedbackStatus } from '../../../../core/models/feedback.model';
```
new:
```typescript
import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { AppFeedback, AppFeedbackList, FeedbackStatus } from '../../../../core/models/verdiq/feedback.model';
```

`ingest.ts` — old:
```typescript
import { AdminApi } from '../../../../core/services/admin-api';
import { IngestList, IngestRow, IngestStatus } from '../../../../core/models/ingest.model';
```
new:
```typescript
import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { IngestList, IngestRow, IngestStatus } from '../../../../core/models/verdiq/ingest.model';
```

- [ ] **Step 4: Copy users.ts and rewrite imports**

```bash
cp "$SRC/users/pages/users/users.ts" "$DEST/users/"
```

Old:
```typescript
import { AdminApi } from '../../../../core/services/admin-api';
import { AuthService } from '../../../../core/services/auth';
import { UserRow, UsersReport } from '../../../../core/models/admin-user.model';
import { Modal } from '../../../../shared/components/modal/modal';
import { ConfirmDeleteModal } from '../../../../shared/components/confirm-delete-modal/confirm-delete-modal';
```
New (note `AuthService` → `VerdiqAuthService` from `verdiq-auth`, matching
Task 3's rename):
```typescript
import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { VerdiqAuthService } from '../../../../core/services/verdiq/verdiq-auth';
import { UserRow, UsersReport } from '../../../../core/models/verdiq/admin-user.model';
import { Modal } from '../../../../shared/components/verdiq/modal/modal';
import { ConfirmDeleteModal } from '../../../../shared/components/verdiq/confirm-delete-modal/confirm-delete-modal';
```

Also rewrite the class body's usage of the injected service — find:
```typescript
  private auth = inject(AuthService);
```
(or however it's spelled in the copied file — read it after copying to
confirm the exact variable name) and change `AuthService` to
`VerdiqAuthService`:
```typescript
  private auth = inject(VerdiqAuthService);
```

- [ ] **Step 5: Register the routes**

In `src/app/app.routes.ts`, append to the `apps/verdiq` route's `children`
array (after `analytics`):

```typescript
      {
        path: 'submissions',
        loadComponent: () =>
          import('./pages/apps/verdiq/submissions/submissions').then(m => m.Submissions),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./pages/apps/verdiq/reports/reports').then(m => m.Reports),
      },
      {
        path: 'feedback',
        loadComponent: () =>
          import('./pages/apps/verdiq/feedback/feedback').then(m => m.Feedback),
      },
      {
        path: 'ingest',
        loadComponent: () =>
          import('./pages/apps/verdiq/ingest/ingest').then(m => m.Ingest),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/apps/verdiq/users/users').then(m => m.Users),
      },
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`, then `ng build`.
Expected: builds clean. Manually check (`ng serve`) all five pages render;
Users page in particular should show `currentUserId` matching the service
account's own id (confirms `VerdiqAuthService.user()` is populated from the
silently-obtained token).

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/apps/verdiq/submissions src/app/pages/apps/verdiq/reports src/app/pages/apps/verdiq/feedback src/app/pages/apps/verdiq/ingest src/app/pages/apps/verdiq/users src/app/app.routes.ts
git commit -m "Migrate Submissions, Reports, Feedback, Ingest review, Users & testers"
```

---

### Task 15: End-to-end smoke test

**Files:** none (verification only).

- [ ] **Step 1: Fill in real service-credential values locally**

Edit `src/environments/environment.ts` locally (do not commit real values) to
replace `serviceEmail`/`servicePassword` placeholders with a real
verdiq-backend admin account's credentials.

- [ ] **Step 2: Full build**

Run: `ng build`
Expected: succeeds with no errors or new warnings.

- [ ] **Step 3: Fresh dev server + hard refresh**

Run: `ng serve`, open the app in a browser with a hard refresh (this
project's convention — a stale dev-server cache has previously been mistaken
for a bug here).

- [ ] **Step 4: Manual walkthrough**

- Log into the vamaha-www shell once.
- Click the Verdiq tile from the home grid — confirm it lands on
  `/apps/verdiq/overview` with no visible second login prompt.
- Click through all 13 nav items — confirm each loads data (no perpetual
  "Loading…" state, no console errors) and renders with the `.verdiq-app`
  scoped styling (light theme, cards/tables/pills as in the original
  verdiq-admin, not raw unstyled HTML — a sign the CSS scoping from Task 7
  failed).
- Open browser dev tools → Network tab: confirm calls to
  `know-ingredients-backend.onrender.com` carry an `Authorization: Bearer …`
  header, and that this token differs from the one sent on vamaha-backend
  calls (confirms interceptor scoping from Task 8 is correct, not
  accidentally sending the shell's own token to verdiq-backend or vice
  versa).
- Navigate to `/apps/vamaha` and `/apps/emi-planner`: confirm both still work
  exactly as before (regression check for Task 6's `AppShellComponent`
  change).

- [ ] **Step 5: Report status**

If any manual check fails, note which one and stop — do not mark this plan
complete until the full walkthrough passes.
