# Admin Shell — Tile-Based Multi-App Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `vamaha-www` from a single-purpose Vamaha admin app into a shell:
login → tile grid (Vamaha, EMI Planner, Settings) → each tile lazy-loads only its
own module. Wires in the existing Vamaha admin (moved under `/apps/vamaha/...`)
and adds a new, real EMI Planner analytics tile.

**Architecture:** New `AppTile` registry drives the tile grid. Existing
`AuthService`/`authGuard`/`authInterceptor` (unchanged) gate every route except
`/login`. Both live tiles share `vamaha-backend` and the shell's token — no new
auth wiring this phase. A stub `AppSessionService` documents the future
cross-backend extension point without being exercised.

**Tech Stack:** Angular 21 (standalone components), Tailwind CSS v3, TypeScript
strict mode — same stack, no new dependencies.

## Global Constraints

- Standalone components only — never `@NgModule`.
- Template in a separate `.html` file — never inline `template:` strings.
- Colors: Tailwind tokens only, except per-app `accentColor` as a dynamic inline
  style (existing project exception, documented in `design-tokens.md`).
- No `any` types.
- `@if` / `@for` control flow, not `*ngIf` / `*ngFor`.
- After every `.ts`/`.html` change: `npx tsc --noEmit` must pass.
- Verification must include a **freshly started** `ng serve` + hard browser
  refresh before calling any task done — a stale dev-server cache was mistaken
  for a real styling bug once already in this project.
- Spec: `docs/superpowers/specs/2026-08-02-admin-shell-design.md`

---

### Task 1: App registry model

**Files:**
- Create: `src/app/core/models/app-registry.model.ts`

**Interfaces:**
- Produces: `AppTile` interface, `APP_REGISTRY: AppTile[]` constant (2 entries:
  `vamaha`, `emi-planner`) — consumed by `HomeComponent` (Task 7).

- [ ] **Step 1: Create the model**

```ts
export interface AppTile {
  id: string;
  name: string;
  icon: string;
  accentColor: string;
  route: string;
  /** How this app authenticates: 'shell' reuses the shell's AuthService token
   *  directly. A future cross-backend app (e.g. Verdiq) would add a
   *  'service-credential' mode handled by AppSessionService. */
  authMode: 'shell';
}

export const APP_REGISTRY: AppTile[] = [
  {
    id: 'vamaha',
    name: 'Vamaha',
    icon: '📝',
    accentColor: 'var(--color-primary)',
    route: '/apps/vamaha',
    authMode: 'shell',
  },
  {
    id: 'emi-planner',
    name: 'EMI Planner',
    icon: '📊',
    accentColor: 'var(--color-gold)',
    route: '/apps/emi-planner/analytics',
    authMode: 'shell',
  },
];
```

- [ ] **Step 2: Verify**

```bash
cd c:/project2/vamaha-workspace/vamaha-www
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/models
git commit -m "feat: add AppTile registry"
```

---

### Task 2: AppSessionService stub

**Files:**
- Create: `src/app/core/services/app-session.service.ts`

**Interfaces:**
- Produces: `AppSessionService` (`providedIn: 'root'`) with `getToken(appId)` /
  `setToken(appId, token)`. Not consumed by anything yet in this plan — it's the
  documented extension point for a future cross-backend app (see spec's Auth
  model section). Do not wire it into any component or interceptor this task.

- [ ] **Step 1: Create the service**

```ts
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

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/services/app-session.service.ts
git commit -m "feat: add AppSessionService stub for future cross-backend auth"
```

---

### Task 3: Analytics model and service

**Files:**
- Create: `src/app/models/analytics.model.ts`
- Create: `src/app/core/services/analytics.service.ts`

**Interfaces:**
- Produces: `AnalyticsSummary` interface (matches `vamaha-backend`'s
  `GET /analytics/summary` response shape exactly) — consumed by
  `AnalyticsService` and `AnalyticsComponent` (Task 9).
- Produces: `AnalyticsService.summary(days = 30): Observable<AnalyticsSummary>` —
  hits `GET {apiBaseUrl}/analytics/summary?days=N`, same
  `{ success, data }` unwrap pattern as `AdminContentService`.

- [ ] **Step 1: Create `analytics.model.ts`**

```ts
/** One app's event count, as returned in GET /analytics/summary's byApp array. */
export interface AnalyticsByApp {
  appSlug: string | null;
  count: number;
}

/** Response shape of GET /analytics/summary (admin, Bearer-gated). */
export interface AnalyticsSummary {
  rangeDays: number;
  totalEvents: number;
  uniqueVisitors: number;
  feedbackInRange: number;
  byType: { type: string; count: number }[];
  byApp: AnalyticsByApp[];
  byCountry: { countryCode: string | null; count: number }[];
  byDevice: { deviceType: string | null; count: number }[];
  byBrowser: { browser: string | null; count: number }[];
  byReferrerHost: { referrerHost: string | null; count: number }[];
}
```

- [ ] **Step 2: Create `analytics.service.ts`**

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AnalyticsSummary } from '../../models/analytics.model';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Admin-only analytics operations. Same shape as AdminContentService: the
 * auth interceptor adds the Bearer token automatically, errors surface to
 * the caller instead of being swallowed.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  summary(days = 30): Observable<AnalyticsSummary> {
    return this.http
      .get<ApiResponse<AnalyticsSummary>>(`${this.base}/analytics/summary?days=${days}`)
      .pipe(map((res) => res.data));
  }
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/models/analytics.model.ts src/app/core/services/analytics.service.ts
git commit -m "feat: add AnalyticsSummary model and AnalyticsService"
```

---

### Task 4: Move AdminDashboardComponent under apps/vamaha

**Files:**
- Create: `src/app/pages/apps/vamaha/admin-dashboard/admin-dashboard.component.ts`
- Create: `src/app/pages/apps/vamaha/admin-dashboard/admin-dashboard.component.html`

**Interfaces:**
- Consumes: `AuthService`, `AdminContentService`, `Article` — same as before, one
  more `../` in each relative import path (new directory is one level deeper).
- Produces: `AdminDashboardComponent` at its new location — consumed by
  `app.routes.ts` (Task 10) at path `apps/vamaha` instead of `admin`.
- Behavior change from the current file: the two `router.navigate(['/admin/articles', ...])`
  calls become `router.navigate(['/apps/vamaha/articles', ...])`, and the two
  `routerLink` targets in the template (`/admin/push` → `/apps/vamaha/push`,
  `['/admin/articles', a.id]` → `['/apps/vamaha/articles', a.id]`) update to match
  the new route prefix. Nothing else changes.
- **Note:** this task only creates the new file — it does NOT delete
  `src/app/pages/admin/admin-dashboard/` (the old copy) and does NOT touch
  `app.routes.ts`. Both files exist side by side, unreferenced duplication is
  expected and harmless, until Task 10's single cutover deletes the old
  `pages/admin/` tree and rewrites routing atomically. This keeps `tsc --noEmit`
  passing after every task instead of breaking for several tasks in a row.

- [ ] **Step 1: Create the new `.ts` file**

```ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AuthService } from '../../../../core/services/auth.service';
import { AdminContentService } from '../../../../core/services/admin-content.service';
import { Article } from '../../../../models/article.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './admin-dashboard.component.html',
})
export class AdminDashboardComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly admin = inject(AdminContentService);
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);

  readonly articles = signal<Article[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');

  topic = '';
  sourcesText = '';
  category = 'update';
  guidance = '';
  readonly genStatus = signal<'idle' | 'running' | 'error'>('idle');
  readonly genError = signal('');

  newTitle = '';
  readonly newStatus = signal<'idle' | 'creating' | 'error'>('idle');
  readonly newError = signal('');

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      await this.auth.loadUser();
      this.loadArticles();
    } catch {
      this.auth.logout();
      void this.router.navigate(['/login']);
    }
  }

  loadArticles(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.admin.listAll().subscribe({
      next: (list) => {
        this.articles.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load articles.');
        this.loading.set(false);
      },
    });
  }

  generate(): void {
    if (this.genStatus() === 'running') return;
    const sources = this.parseSources();
    if (!this.topic.trim() || sources.length === 0) {
      this.genStatus.set('error');
      this.genError.set('Add a topic and at least one source URL.');
      return;
    }
    this.genStatus.set('running');
    this.genError.set('');
    this.admin
      .generateDraft({
        topic: this.topic.trim(),
        sources,
        category: this.category.trim() || 'update',
        guidance: this.guidance.trim() || undefined,
      })
      .subscribe({
        next: (draft) => {
          this.articles.update((list) => [draft, ...list]);
          this.resetForm();
          this.genStatus.set('idle');
          void this.router.navigate(['/apps/vamaha/articles', draft.id]);
        },
        error: (err: unknown) => {
          this.genStatus.set('error');
          this.genError.set(this.messageFor(err));
        },
      });
  }

  /** Create a blank draft and jump straight into the editor to write it by hand. */
  writeNew(): void {
    if (this.newStatus() === 'creating') return;
    const title = this.newTitle.trim();
    if (title.length < 2) {
      this.newStatus.set('error');
      this.newError.set('Give the article a title to start.');
      return;
    }
    this.newStatus.set('creating');
    this.newError.set('');
    this.admin
      .create({
        slug: this.slugify(title),
        title,
        excerpt: 'Draft — add a one-line summary before publishing.',
        bodyMd: `# ${title}\n\nStart writing here…`,
        author: this.auth.user()?.name || 'Vamaha Editorial',
        category: 'update',
      })
      .subscribe({
        next: (draft) => {
          this.newTitle = '';
          this.newStatus.set('idle');
          void this.router.navigate(['/apps/vamaha/articles', draft.id]);
        },
        error: (err: unknown) => {
          this.newStatus.set('error');
          this.newError.set(this.messageFor(err));
        },
      });
  }

  private slugify(title: string): string {
    const base = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);
    return `${base || 'article'}-${Date.now().toString(36).slice(-4)}`;
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }

  private parseSources(): string[] {
    return this.sourcesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private resetForm(): void {
    this.topic = '';
    this.sourcesText = '';
    this.guidance = '';
    this.category = 'update';
  }

  private messageFor(err: unknown): string {
    const status = (err as { status?: number })?.status;
    if (status === 503) return 'Draft generation is not configured on the server (missing API key).';
    if (status === 422) return 'Could not draft from those sources. Check the URLs or revise the topic.';
    if (status === 401) return 'Your session expired. Please sign in again.';
    return 'Generation failed. Please try again.';
  }
}
```

- [ ] **Step 2: Create the new `.html` file**

```html
<main class="min-h-screen bg-bg text-text">
  <!-- Top bar -->
  <header class="border-b border-border">
    <div class="max-w-[1800px] mx-auto px-6 lg:px-8 py-4 flex items-center justify-between">
      <div>
        <h1 class="text-lg font-bold">
          <span class="gradient-text">Vamaha</span> Admin
        </h1>
        @if (auth.user(); as u) {
          <p class="text-text2 text-xs mt-0.5">{{ u.name }} · {{ u.role }}</p>
        }
      </div>
      <div class="flex items-center gap-3">
        <a
          routerLink="/apps/vamaha/push"
          class="text-sm text-text2 hover:text-text border border-border hover:bg-surface rounded-xl px-4 py-2 transition-colors"
        >
          Push Notifications
        </a>
        <button
          (click)="logout()"
          class="text-sm text-text2 hover:text-text border border-border hover:bg-surface rounded-xl px-4 py-2 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  </header>

  <div class="max-w-[1800px] mx-auto px-6 lg:px-8 py-10 space-y-12">
    <!-- ── Write a new article (manual, no RAG cost) ────────── -->
    <section>
      <h2 class="text-xl font-bold mb-1">Write a new article</h2>
      <p class="text-text2 text-sm mb-6">
        Start a blank draft and write it by hand in the editor. Free — no
        generation cost. You can add the Telugu translation for the app later.
      </p>

      <form
        (ngSubmit)="writeNew()"
        class="bg-card border border-border rounded-3xl p-6 md:p-8 flex flex-col sm:flex-row gap-4 sm:items-end"
      >
        <div class="flex-1">
          <label for="newTitle" class="block text-sm text-text2 mb-1.5">Article title</label>
          <input
            id="newTitle"
            name="newTitle"
            [(ngModel)]="newTitle"
            class="w-full px-4 py-3 bg-surface border border-border rounded-xl text-text placeholder:text-text2 focus:outline-none focus:border-primary transition-colors"
            placeholder="What a repo-rate cut really does to your EMI"
          />
        </div>
        <button
          type="submit"
          [disabled]="newStatus() === 'creating'"
          class="py-3 px-6 bg-primary hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-2xl transition-colors whitespace-nowrap"
        >
          {{ newStatus() === 'creating' ? 'Creating…' : 'Start writing →' }}
        </button>
      </form>
      @if (newError()) {
        <p class="text-danger text-sm mt-3">{{ newError() }}</p>
      }
    </section>

    <!-- ── Generate a draft (RAG) ───────────────────────────── -->
    <section>
      <h2 class="text-xl font-bold mb-1">Generate a draft</h2>
      <p class="text-text2 text-sm mb-6">
        Give a topic and trusted source URLs (RBI / SEBI). The draft is grounded
        in those sources and saved for your review — nothing is published.
      </p>

      <form
        (ngSubmit)="generate()"
        class="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-5"
      >
        <div>
          <label for="topic" class="block text-sm text-text2 mb-1.5">Topic</label>
          <input
            id="topic"
            name="topic"
            [(ngModel)]="topic"
            class="w-full px-4 py-3 bg-surface border border-border rounded-xl text-text placeholder:text-text2 focus:outline-none focus:border-primary transition-colors"
            placeholder="How an RBI repo-rate change affects your home loan EMI"
          />
        </div>

        <div>
          <label for="sources" class="block text-sm text-text2 mb-1.5">
            Source URLs <span class="text-text2">(one per line, 1–6)</span>
          </label>
          <textarea
            id="sources"
            name="sources"
            [(ngModel)]="sourcesText"
            rows="3"
            class="w-full px-4 py-3 bg-surface border border-border rounded-xl text-text placeholder:text-text2 focus:outline-none focus:border-primary transition-colors font-mono text-sm"
            placeholder="https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12528"
          ></textarea>
        </div>

        <div class="grid md:grid-cols-2 gap-5">
          <div>
            <label for="category" class="block text-sm text-text2 mb-1.5">Category</label>
            <input
              id="category"
              name="category"
              [(ngModel)]="category"
              class="w-full px-4 py-3 bg-surface border border-border rounded-xl text-text focus:outline-none focus:border-primary transition-colors"
              placeholder="update"
            />
          </div>
          <div>
            <label for="guidance" class="block text-sm text-text2 mb-1.5">
              Guidance <span class="text-text2">(optional)</span>
            </label>
            <input
              id="guidance"
              name="guidance"
              [(ngModel)]="guidance"
              class="w-full px-4 py-3 bg-surface border border-border rounded-xl text-text placeholder:text-text2 focus:outline-none focus:border-primary transition-colors"
              placeholder="Keep it beginner-friendly"
            />
          </div>
        </div>

        @if (genError()) {
          <p class="text-danger text-sm">{{ genError() }}</p>
        }

        <button
          type="submit"
          [disabled]="genStatus() === 'running'"
          class="py-3.5 px-6 bg-primary hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-2xl transition-colors"
        >
          {{ genStatus() === 'running' ? 'Drafting… (~30s)' : 'Generate draft' }}
        </button>
      </form>
    </section>

    <!-- ── Articles ─────────────────────────────────────────── -->
    <section>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-bold">Articles</h2>
        <button
          (click)="loadArticles()"
          class="text-sm text-text2 hover:text-text transition-colors"
        >
          Refresh
        </button>
      </div>

      @if (loading()) {
        <p class="text-text2 text-sm">Loading…</p>
      } @else if (loadError()) {
        <p class="text-danger text-sm">{{ loadError() }}</p>
      } @else if (articles().length === 0) {
        <p class="text-text2 text-sm">No articles yet. Write your first one above.</p>
      } @else {
        <div class="border border-border rounded-3xl overflow-hidden divide-y divide-border">
          @for (a of articles(); track a.id) {
            <a
              [routerLink]="['/apps/vamaha/articles', a.id]"
              class="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface transition-colors"
            >
              <div class="min-w-0">
                <p class="font-medium truncate">{{ a.title }}</p>
                <p class="text-text2 text-xs mt-0.5">
                  /{{ a.slug }} · updated {{ a.updatedAt | date: 'mediumDate' }}
                </p>
              </div>
              <span
                class="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
                [class.bg-success]="a.status === 'PUBLISHED'"
                [class.text-bg]="a.status === 'PUBLISHED'"
                [class.bg-surface]="a.status !== 'PUBLISHED'"
                [class.text-text2]="a.status !== 'PUBLISHED'"
                [class.border]="a.status !== 'PUBLISHED'"
                [class.border-border]="a.status !== 'PUBLISHED'"
              >
                {{ a.status }}
              </span>
            </a>
          }
        </div>
      }
    </section>
  </div>
</main>
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```
Expected: PASS. `app.routes.ts` still points at the old `pages/admin/admin-dashboard/`
path and that file still exists (untouched) — this is fine, the two components
just coexist until Task 10.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/apps/vamaha/admin-dashboard
git commit -m "feat: add AdminDashboardComponent at its new pages/apps/vamaha location"
```

---

### Task 5: Move AdminArticleComponent under apps/vamaha

**Files:**
- Create: `src/app/pages/apps/vamaha/admin-article/admin-article.component.ts`
- Create: `src/app/pages/apps/vamaha/admin-article/admin-article.component.html`

**Interfaces:**
- Consumes: `AdminContentService`, `Article`, `MarkdownEditorComponent`,
  `environment.siteUrl` — same as before, one more `../` in each relative import.
- Produces: `AdminArticleComponent` at its new location — consumed by
  `app.routes.ts` (Task 10) at path `apps/vamaha/articles/:id`.
- Behavior change from the current file: the `routerLink="/admin"` back-link
  becomes `routerLink="/apps/vamaha"`. Nothing else changes (the "View live"
  link fix from the prior migration — `siteUrl + '/learn/' + a.slug`,
  `target="_blank"`, `rel="noopener"` — is preserved as-is).
- **Note:** as in Task 4, this only creates the new file — the old
  `src/app/pages/admin/admin-article/` copy and `app.routes.ts` are untouched
  until Task 10's single cutover.

- [ ] **Step 1: Create the new `.ts` file**

```ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AdminContentService } from '../../../../core/services/admin-content.service';
import { Article } from '../../../../models/article.model';
import { MarkdownEditorComponent } from '../../../../shared/components/markdown-editor/markdown-editor.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-admin-article',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, MarkdownEditorComponent],
  templateUrl: './admin-article.component.html',
})
export class AdminArticleComponent implements OnInit {
  private readonly admin = inject(AdminContentService);
  private readonly route = inject(ActivatedRoute);
  private readonly meta = inject(Meta);

  readonly siteUrl = environment.siteUrl;

  private id = '';
  readonly article = signal<Article | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal('');

  readonly lang = signal<'en' | 'te'>('en');

  title = '';
  excerpt = '';
  bodyMd = '';
  titleTe = '';
  excerptTe = '';
  bodyMdTe = '';
  seoTitle = '';
  seoDescription = '';

  readonly saveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  readonly publishStatus = signal<'idle' | 'publishing' | 'error'>('idle');
  readonly actionError = signal('');

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.admin.getOne(this.id).subscribe({
      next: (a) => {
        this.apply(a);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load this article.');
        this.loading.set(false);
      },
    });
  }

  save(): void {
    if (this.saveStatus() === 'saving') return;
    this.saveStatus.set('saving');
    this.actionError.set('');
    this.admin
      .update(this.id, {
        title: this.title.trim(),
        excerpt: this.excerpt.trim(),
        bodyMd: this.bodyMd,
        titleTe: this.titleTe.trim() || null,
        excerptTe: this.excerptTe.trim() || null,
        bodyMdTe: this.bodyMdTe.trim() || null,
        seoTitle: this.seoTitle.trim() || null,
        seoDescription: this.seoDescription.trim() || null,
      })
      .subscribe({
        next: (a) => {
          this.apply(a);
          this.saveStatus.set('saved');
        },
        error: (err: unknown) => {
          this.saveStatus.set('error');
          this.actionError.set(this.messageFor(err));
        },
      });
  }

  publish(): void {
    if (this.publishStatus() === 'publishing') return;
    if (!confirm('Publish this article? It will go live on the site.')) return;
    this.publishStatus.set('publishing');
    this.actionError.set('');
    this.admin.publish(this.id).subscribe({
      next: (a) => {
        this.apply(a);
        this.publishStatus.set('idle');
      },
      error: (err: unknown) => {
        this.publishStatus.set('error');
        this.actionError.set(this.messageFor(err));
      },
    });
  }

  private apply(a: Article): void {
    this.article.set(a);
    this.title = a.title;
    this.excerpt = a.excerpt;
    this.bodyMd = a.bodyMd;
    this.titleTe = a.titleTe ?? '';
    this.excerptTe = a.excerptTe ?? '';
    this.bodyMdTe = a.bodyMdTe ?? '';
    this.seoTitle = a.seoTitle ?? '';
    this.seoDescription = a.seoDescription ?? '';
  }

  private messageFor(err: unknown): string {
    const status = (err as { status?: number })?.status;
    if (status === 401) return 'Your session expired. Please sign in again.';
    return 'Action failed. Please try again.';
  }
}
```

- [ ] **Step 2: Create the new `.html` file**

```html
<main class="min-h-screen bg-bg text-text">
  <!-- ── Sticky action bar: back · title · status · Save · Publish ── -->
  <header class="sticky top-0 z-20 bg-bg/85 backdrop-blur border-b border-border">
    <div class="w-full px-6 lg:px-8 py-3 flex items-center gap-4">
      <a routerLink="/apps/vamaha" class="shrink-0 text-sm text-text2 hover:text-text transition-colors">
        ← Dashboard
      </a>

      @if (article(); as a) {
        <div class="min-w-0 flex-1 flex items-center gap-3">
          <span class="truncate text-sm font-medium text-text2">{{ title || 'Untitled' }}</span>
          <span
            class="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full"
            [class.bg-success]="a.status === 'PUBLISHED'"
            [class.text-bg]="a.status === 'PUBLISHED'"
            [class.bg-surface]="a.status !== 'PUBLISHED'"
            [class.text-text2]="a.status !== 'PUBLISHED'"
            [class.border]="a.status !== 'PUBLISHED'"
            [class.border-border]="a.status !== 'PUBLISHED'"
          >{{ a.status }}</span>
        </div>

        <div class="shrink-0 flex items-center gap-2.5">
          @if (saveStatus() === 'saved') {
            <span class="text-success text-xs">Saved ✓</span>
          }
          <button
            (click)="save()"
            [disabled]="saveStatus() === 'saving'"
            class="py-2 px-4 border border-border hover:bg-surface disabled:opacity-50 text-text text-sm font-semibold rounded-xl transition-colors"
          >
            {{ saveStatus() === 'saving' ? 'Saving…' : 'Save' }}
          </button>

          @if (a.status === 'PUBLISHED') {
            <a
              [href]="siteUrl + '/learn/' + a.slug"
              target="_blank"
              rel="noopener"
              class="py-2 px-4 text-primary hover:text-accent text-sm font-semibold transition-colors"
            >View live →</a>
          } @else {
            <button
              (click)="publish()"
              [disabled]="publishStatus() === 'publishing'"
              class="py-2 px-4 bg-success hover:opacity-90 disabled:opacity-50 text-bg text-sm font-semibold rounded-xl transition-opacity"
            >
              {{ publishStatus() === 'publishing' ? 'Publishing…' : 'Publish' }}
            </button>
          }
        </div>
      }
    </div>
  </header>

  <!-- Full-bleed container: the writing + preview surface owns the whole width -->
  <div class="w-full px-6 lg:px-8 py-6">
    @if (loading()) {
      <p class="text-text2 text-sm">Loading…</p>
    } @else if (loadError()) {
      <p class="text-danger text-sm">{{ loadError() }}</p>
    } @else if (article(); as a) {
      @if (actionError()) {
        <div class="mb-6 px-4 py-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
          {{ actionError() }}
        </div>
      }

      <!-- Language switch — sets which content the editor shows -->
      <div class="flex flex-wrap items-center gap-3 mb-6">
        <div class="inline-flex rounded-xl border border-border overflow-hidden text-sm">
          <button
            type="button" (click)="lang.set('en')"
            [class.bg-primary]="lang() === 'en'" [class.text-white]="lang() === 'en'"
            [class.text-text2]="lang() !== 'en'"
            class="px-4 py-2 font-medium transition-colors"
          >English</button>
          <button
            type="button" (click)="lang.set('te')"
            [class.bg-primary]="lang() === 'te'" [class.text-white]="lang() === 'te'"
            [class.text-text2]="lang() !== 'te'"
            class="px-4 py-2 font-medium transition-colors border-l border-border"
          >తెలుగు</button>
        </div>
        <p class="text-text2 text-xs">
          @if (lang() === 'en') {
            Shown on the website and the app.
          } @else {
            Optional translation — shown only in the EMI Planner app.
          }
        </p>
      </div>

      <form (ngSubmit)="save()" class="space-y-6">
        <!-- ── Main writing surface (full width, top priority) ── -->
        <section class="bg-card border border-border rounded-3xl overflow-hidden">
          <div class="px-6 py-4 border-b border-border">
            <h2 class="text-sm font-semibold">
              {{ lang() === 'en' ? 'Article content' : 'Telugu content (app only)' }}
            </h2>
          </div>

          <div class="p-6 space-y-5">
            @if (lang() === 'en') {
              <div>
                <label for="title" class="block text-xs uppercase tracking-wide text-text2 mb-1.5">Title</label>
                <input
                  id="title" name="title" [(ngModel)]="title"
                  placeholder="What a repo-rate cut really does to your EMI"
                  class="w-full px-4 py-3 bg-surface border border-border rounded-xl text-text text-lg font-semibold placeholder:text-text2 placeholder:font-normal focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label for="excerpt" class="block text-xs uppercase tracking-wide text-text2 mb-1.5">
                  Excerpt <span class="normal-case tracking-normal text-text2">— the one-line summary in listings</span>
                </label>
                <textarea
                  id="excerpt" name="excerpt" [(ngModel)]="excerpt" rows="2"
                  class="w-full px-4 py-3 bg-surface border border-border rounded-xl text-text focus:outline-none focus:border-primary transition-colors text-sm"
                ></textarea>
              </div>
              <div>
                <label class="block text-xs uppercase tracking-wide text-text2 mb-1.5">
                  Body <span class="normal-case tracking-normal text-text2">— type on the left, live preview on the right</span>
                </label>
                <app-markdown-editor [(value)]="bodyMd" height="700px" placeholder="Write the article in Markdown…" />
              </div>
            } @else {
              <div>
                <label for="titleTe" class="block text-xs uppercase tracking-wide text-text2 mb-1.5">Title (Telugu)</label>
                <input
                  id="titleTe" name="titleTe" [(ngModel)]="titleTe"
                  class="w-full px-4 py-3 bg-surface border border-border rounded-xl text-text text-lg font-semibold focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label for="excerptTe" class="block text-xs uppercase tracking-wide text-text2 mb-1.5">Excerpt (Telugu)</label>
                <textarea
                  id="excerptTe" name="excerptTe" [(ngModel)]="excerptTe" rows="2"
                  class="w-full px-4 py-3 bg-surface border border-border rounded-xl text-text focus:outline-none focus:border-primary transition-colors text-sm"
                ></textarea>
              </div>
              <div>
                <label class="block text-xs uppercase tracking-wide text-text2 mb-1.5">Body (Telugu)</label>
                <app-markdown-editor [(value)]="bodyMdTe" height="700px" placeholder="తెలుగులో వ్యాసం రాయండి…" />
              </div>
            }
          </div>
        </section>

        <!-- ── Secondary: SEO + details, below the writing surface ── -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section class="bg-card border border-border rounded-3xl overflow-hidden">
            <div class="px-6 py-4 border-b border-border">
              <h2 class="text-sm font-semibold">Search &amp; social</h2>
              <p class="text-text2 text-xs mt-0.5">Falls back to title &amp; excerpt if blank.</p>
            </div>
            <div class="p-6 space-y-4">
              <div>
                <label for="seoTitle" class="block text-xs uppercase tracking-wide text-text2 mb-1.5">SEO title</label>
                <input
                  id="seoTitle" name="seoTitle" [(ngModel)]="seoTitle"
                  class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-text focus:outline-none focus:border-primary transition-colors text-sm"
                />
              </div>
              <div>
                <label for="seoDescription" class="block text-xs uppercase tracking-wide text-text2 mb-1.5">SEO description</label>
                <textarea
                  id="seoDescription" name="seoDescription" [(ngModel)]="seoDescription" rows="3"
                  class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-text focus:outline-none focus:border-primary transition-colors text-sm"
                ></textarea>
              </div>
            </div>
          </section>

          <section class="bg-card border border-border rounded-3xl overflow-hidden">
            <div class="px-6 py-4 border-b border-border">
              <h2 class="text-sm font-semibold">Details</h2>
            </div>
            <div class="p-6 grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div>
                <p class="text-text2 text-xs uppercase tracking-wide mb-0.5">Author</p>
                <p>{{ a.author }}</p>
              </div>
              <div>
                <p class="text-text2 text-xs uppercase tracking-wide mb-0.5">Last updated</p>
                <p>{{ a.updatedAt | date: 'medium' }}</p>
              </div>
              <div class="sm:col-span-2">
                <p class="text-text2 text-xs uppercase tracking-wide mb-1">Sources</p>
                @if (a.sources.length) {
                  <ul class="space-y-1">
                    @for (s of a.sources; track s) {
                      <li class="break-all text-primary text-xs">{{ s }}</li>
                    }
                  </ul>
                } @else {
                  <p class="text-text2 text-xs">None</p>
                }
              </div>
              @if (a.faq?.length) {
                <div class="sm:col-span-2">
                  <p class="text-text2 text-xs uppercase tracking-wide mb-1">FAQ ({{ a.faq?.length }})</p>
                  <ul class="space-y-2">
                    @for (f of a.faq; track f.question) {
                      <li>
                        <p class="font-medium">{{ f.question }}</p>
                        <p class="text-text2 text-xs">{{ f.answer }}</p>
                      </li>
                    }
                  </ul>
                </div>
              }
            </div>
          </section>
        </div>
      </form>
    }
  </div>
</main>
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```
Expected: PASS. `app.routes.ts` still points at the old `pages/admin/admin-article/`
path and that file still exists (untouched) — fine, resolved in Task 10.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/apps/vamaha/admin-article
git commit -m "feat: add AdminArticleComponent at its new pages/apps/vamaha location"
```

---

### Task 6: Move AdminPushComponent under apps/vamaha

**Files:**
- Create: `src/app/pages/apps/vamaha/admin-push/admin-push.component.ts`
- Create: `src/app/pages/apps/vamaha/admin-push/admin-push.component.html`

**Interfaces:**
- Consumes: `AuthService`, `PushAdminService`, push models — same as before, one
  more `../` in each relative import.
- Produces: `AdminPushComponent` at its new location — consumed by
  `app.routes.ts` (Task 10) at path `apps/vamaha/push`.
- No route-string changes in this component's own template — it has no internal
  `routerLink`/`navigate` calls referencing other admin pages.
- **Note:** as in Tasks 4-5, this only creates the new file — the old
  `src/app/pages/admin/admin-push/` copy and `app.routes.ts` are untouched until
  Task 10's single cutover, which also removes the (by then empty)
  `src/app/pages/admin/` directory entirely.

- [ ] **Step 1: Create the new `.ts` file**

```ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AuthService } from '../../../../core/services/auth.service';
import { PushAdminService } from '../../../../core/services/push-admin.service';
import {
  BroadcastResult,
  CredentialStatus,
  PushCronRunRow,
  PushTokenRow,
} from '../../../../models/push-admin.model';

@Component({
  selector: 'app-admin-push',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './admin-push.component.html',
})
export class AdminPushComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly push = inject(PushAdminService);
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);

  readonly apps = this.push.listApps();
  selectedApp = this.apps[0];

  readonly credential = signal<CredentialStatus | null>(null);
  readonly tokens = signal<PushTokenRow[]>([]);
  readonly cronRuns = signal<PushCronRunRow[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');

  broadcastTitle = '';
  broadcastBody = '';
  readonly broadcastStatus = signal<'idle' | 'sending' | 'error'>('idle');
  readonly broadcastResult = signal<BroadcastResult | null>(null);
  readonly broadcastError = signal('');
  readonly lastActionLabel = signal<'broadcast' | 'cron' | null>(null);

  readonly cronRunning = signal(false);

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      await this.auth.loadUser();
      this.loadAll();
    } catch {
      this.auth.logout();
      void this.router.navigate(['/login']);
    }
  }

  onAppChange(): void {
    this.broadcastResult.set(null);
    this.lastActionLabel.set(null);
    this.loadAll();
  }

  private refreshTokens(): void {
    this.push.listTokens(this.selectedApp).subscribe({
      next: (rows) => this.tokens.set(rows),
      error: () => this.loadError.set('Could not refresh registered devices.'),
    });
  }

  loadAll(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.push.getCredentialStatus().subscribe({
      next: (status) => this.credential.set(status),
      error: () => this.loadError.set('Could not load credential status.'),
    });
    this.push.listTokens(this.selectedApp).subscribe({
      next: (rows) => {
        this.tokens.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load registered devices.');
        this.loading.set(false);
      },
    });
    this.push.getCronRuns(this.selectedApp).subscribe({
      next: (rows) => this.cronRuns.set(rows),
      error: () => this.loadError.set('Could not load cron run history.'),
    });
  }

  sendBroadcast(): void {
    if (this.broadcastStatus() === 'sending') return;
    const title = this.broadcastTitle.trim();
    const body = this.broadcastBody.trim();
    if (!title || !body) {
      this.broadcastStatus.set('error');
      this.broadcastError.set('Title and body are both required.');
      return;
    }
    if (this.tokens().length === 0) {
      this.broadcastStatus.set('error');
      this.broadcastError.set('No devices registered for this app yet.');
      return;
    }
    if (!confirm(`Send this notification to all ${this.tokens().length} registered device(s)?`)) {
      return;
    }
    this.broadcastStatus.set('sending');
    this.broadcastError.set('');
    this.broadcastResult.set(null);
    this.lastActionLabel.set(null);
    this.push.broadcast(this.selectedApp, { title, body }).subscribe({
      next: (result) => {
        this.broadcastResult.set(result);
        this.lastActionLabel.set('broadcast');
        this.broadcastStatus.set('idle');
        this.broadcastTitle = '';
        this.broadcastBody = '';
        this.refreshTokens();
      },
      error: () => {
        this.broadcastStatus.set('error');
        this.broadcastError.set('Broadcast failed. Please try again.');
      },
    });
  }

  runCronNow(): void {
    if (this.cronRunning()) return;
    this.cronRunning.set(true);
    this.broadcastResult.set(null);
    this.lastActionLabel.set(null);
    this.push.runCronNow(this.selectedApp).subscribe({
      next: (result) => {
        this.cronRunning.set(false);
        this.push.getCronRuns(this.selectedApp).subscribe({
          next: (rows) => this.cronRuns.set(rows),
          error: () => this.loadError.set('Could not load cron run history.'),
        });
        this.broadcastResult.set(result);
        this.lastActionLabel.set('cron');
        this.refreshTokens();
      },
      error: () => {
        this.cronRunning.set(false);
        this.loadError.set('Running the dormancy check failed.');
      },
    });
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
```

- [ ] **Step 2: Create the new `.html` file**

```html
<div class="min-h-screen bg-bg text-text">
  <header class="border-b border-border">
    <div class="max-w-[1800px] mx-auto px-6 lg:px-8 py-4 flex items-center justify-between">
      <div>
        <h1 class="text-lg font-bold">
          <span class="gradient-text">Vamaha</span> Push Notifications
        </h1>
        @if (auth.user(); as u) {
          <p class="text-text2 text-xs mt-0.5">{{ u.name }} · {{ u.role }}</p>
        }
      </div>
      <button
        (click)="logout()"
        class="text-sm text-text2 hover:text-text border border-border hover:bg-surface rounded-xl px-4 py-2 transition-colors"
      >
        Sign out
      </button>
    </div>
  </header>

  <div class="max-w-[1800px] mx-auto px-6 lg:px-8 py-10 space-y-12">
    <!-- ── App selector + credential status ────────── -->
    <section class="flex items-center gap-4 flex-wrap">
      <label class="text-sm">
        App:
        <select [(ngModel)]="selectedApp" (ngModelChange)="onAppChange()" class="ml-2 border border-border rounded-lg px-3 py-1.5 bg-surface">
          @for (app of apps; track app) {
            <option [value]="app">{{ app }}</option>
          }
        </select>
      </label>
      @if (credential(); as c) {
        @if (c.configured) {
          <span class="text-xs font-medium px-3 py-1.5 rounded-full bg-green-500/10 text-green-600">Firebase configured</span>
        } @else {
          <span class="text-xs font-medium px-3 py-1.5 rounded-full bg-red-500/10 text-red-600">Not configured — cron is a no-op</span>
        }
      }
    </section>

    @if (loadError()) {
      <p class="text-sm text-red-600">{{ loadError() }}</p>
    }

    <!-- ── Registered devices ────────── -->
    <section>
      <h2 class="text-xl font-bold mb-4">Registered devices ({{ tokens().length }})</h2>
      @if (loading()) {
        <p class="text-text2 text-sm">Loading…</p>
      } @else if (tokens().length === 0) {
        <p class="text-text2 text-sm">No devices registered yet.</p>
      } @else {
        <div class="overflow-x-auto border border-border rounded-xl">
          <table class="w-full text-sm">
            <thead class="bg-surface text-text2 text-left">
              <tr>
                <th class="px-4 py-2">Install ID</th>
                <th class="px-4 py-2">Platform</th>
                <th class="px-4 py-2">Registered</th>
                <th class="px-4 py-2">Last dormancy push</th>
              </tr>
            </thead>
            <tbody>
              @for (t of tokens(); track t.installId) {
                <tr class="border-t border-border">
                  <td class="px-4 py-2 font-mono">{{ t.installId.slice(0, 8) }}…</td>
                  <td class="px-4 py-2">{{ t.platform }}</td>
                  <td class="px-4 py-2">{{ t.createdAt | date: 'medium' }}</td>
                  <td class="px-4 py-2">{{ t.lastDormancyPushAt ? (t.lastDormancyPushAt | date: 'medium') : '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    <!-- ── Send broadcast + Cron run history ────────── -->
    <section class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <h2 class="text-xl font-bold mb-4">Send broadcast</h2>
        <div class="space-y-3">
          <input
            [(ngModel)]="broadcastTitle"
            placeholder="Title"
            class="w-full border border-border rounded-lg px-3 py-2 bg-surface"
          />
          <textarea
            [(ngModel)]="broadcastBody"
            placeholder="Body"
            rows="3"
            class="w-full border border-border rounded-lg px-3 py-2 bg-surface"
          ></textarea>
          @if (broadcastStatus() === 'error') {
            <p class="text-sm text-red-600">{{ broadcastError() }}</p>
          }
          @if (broadcastResult(); as r) {
            <p class="text-sm text-green-600">
              @if (lastActionLabel() === 'cron') {
                Cron run:
                @if (r.candidates !== undefined) { {{ r.candidates }} candidates · }
                Sent: {{ r.sent }}
              } @else {
                Broadcast sent: {{ r.sent }}
              }
              @if (r.failed !== undefined) { · Failed: {{ r.failed }} }
              · Stale removed: {{ r.staleRemoved }}
              @if (r.total !== undefined) { · Total: {{ r.total }} }
            </p>
          }
          @if (credential() && !credential()?.configured) {
            <p class="text-sm text-amber-600">Set FIREBASE_SERVICE_ACCOUNT_JSON on Render first — broadcasting is disabled until then.</p>
          } @else if (tokens().length === 0) {
            <p class="text-sm text-text2">No devices registered for this app yet — nothing to broadcast to.</p>
          }
          <button
            (click)="sendBroadcast()"
            [disabled]="broadcastStatus() === 'sending' || !credential()?.configured || tokens().length === 0"
            class="bg-primary text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {{ broadcastStatus() === 'sending' ? 'Sending…' : 'Send to all devices' }}
          </button>
        </div>
      </div>

      <div>
        <h2 class="text-xl font-bold mb-4">Cron run history</h2>
        <button
          (click)="runCronNow()"
          [disabled]="cronRunning()"
          class="mb-4 text-sm border border-border hover:bg-surface rounded-xl px-4 py-2 transition-colors disabled:opacity-50"
        >
          {{ cronRunning() ? 'Running…' : 'Run dormancy check now' }}
        </button>
        @if (cronRuns().length === 0) {
          <p class="text-text2 text-sm">No runs yet.</p>
        } @else {
          <div class="overflow-x-auto border border-border rounded-xl">
            <table class="w-full text-sm">
              <thead class="bg-surface text-text2 text-left">
                <tr>
                  <th class="px-4 py-2">Ran at</th>
                  <th class="px-4 py-2">Candidates</th>
                  <th class="px-4 py-2">Sent</th>
                  <th class="px-4 py-2">Stale removed</th>
                </tr>
              </thead>
              <tbody>
                @for (r of cronRuns(); track r.id) {
                  <tr class="border-t border-border">
                    <td class="px-4 py-2">{{ r.ranAt | date: 'medium' }}</td>
                    <td class="px-4 py-2">{{ r.candidates }}</td>
                    <td class="px-4 py-2">{{ r.sent }}</td>
                    <td class="px-4 py-2">{{ r.staleRemoved }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </section>
  </div>
</div>
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```
Expected: PASS. `app.routes.ts` still points at the old `pages/admin/admin-push/`
path and that file still exists (untouched) — fine, resolved in Task 10, which
deletes all of `src/app/pages/admin/` in one shot now that Tasks 4-6 have all
three replacements ready under `pages/apps/vamaha/`.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/apps/vamaha/admin-push
git commit -m "feat: add AdminPushComponent at its new pages/apps/vamaha location"
```

---

### Task 7: HomeComponent (tile grid)

**Files:**
- Create: `src/app/pages/home/home.component.ts`
- Create: `src/app/pages/home/home.component.html`

**Interfaces:**
- Consumes: `AuthService` (validates the session on load, same pattern as the
  moved admin pages), `APP_REGISTRY` (Task 1).
- Produces: `HomeComponent` — consumed by `app.routes.ts` (Task 10) at path `''`.

- [ ] **Step 1: Create the `.ts` file**

```ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { APP_REGISTRY } from '../../core/models/app-registry.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly apps = APP_REGISTRY;
  readonly loading = signal(true);

  ngOnInit(): void {
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      await this.auth.loadUser();
    } catch {
      this.auth.logout();
      void this.router.navigate(['/login']);
      return;
    }
    this.loading.set(false);
  }
}
```

- [ ] **Step 2: Create the `.html` file**

```html
<main class="min-h-screen bg-bg text-text">
  <header class="border-b border-border">
    <div class="max-w-[1800px] mx-auto px-6 lg:px-8 py-4 flex items-center justify-between">
      <h1 class="text-lg font-bold">
        <span class="gradient-text">Vamaha</span> Admin
      </h1>
      <a
        routerLink="/settings"
        class="text-sm text-text2 hover:text-text border border-border hover:bg-surface rounded-xl px-4 py-2 transition-colors"
      >
        Settings
      </a>
    </div>
  </header>

  @if (!loading()) {
    <div class="max-w-[1800px] mx-auto px-6 lg:px-8 py-10">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        @for (app of apps; track app.id) {
          <a
            [routerLink]="app.route"
            class="bg-card border border-border rounded-3xl p-7 flex flex-col hover:border-primary transition-colors"
          >
            <div
              class="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-5"
              [style.background-color]="app.accentColor + '20'"
              [style.border]="'1px solid ' + app.accentColor + '40'"
            >{{ app.icon }}</div>
            <h2 class="text-xl font-bold text-text">{{ app.name }}</h2>
          </a>
        }
      </div>
    </div>
  }
</main>
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```
Expected: PASS. This file isn't imported by `app.routes.ts` yet — that wiring
happens in Task 10 — so it just needs to compile cleanly on its own.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/home
git commit -m "feat: add HomeComponent (tile grid)"
```

---

### Task 8: SettingsComponent

**Files:**
- Create: `src/app/pages/settings/settings.component.ts`
- Create: `src/app/pages/settings/settings.component.html`

**Interfaces:**
- Consumes: `AuthService`.
- Produces: `SettingsComponent` — consumed by `app.routes.ts` (Task 10) at path
  `settings`.

- [ ] **Step 1: Create the `.ts` file**

```ts
import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      await this.auth.loadUser();
    } catch {
      this.auth.logout();
      void this.router.navigate(['/login']);
    }
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
```

- [ ] **Step 2: Create the `.html` file**

```html
<main class="min-h-screen bg-bg text-text flex items-center justify-center px-6">
  <div class="w-full max-w-sm">
    <a routerLink="/" class="text-sm text-text2 hover:text-text transition-colors mb-6 inline-block">
      ← All apps
    </a>

    <div class="bg-card border border-border rounded-3xl p-8 space-y-5">
      <h1 class="text-xl font-bold">Account</h1>
      @if (auth.user(); as u) {
        <div class="space-y-2 text-sm">
          <p><span class="text-text2">Name:</span> {{ u.name }}</p>
          <p><span class="text-text2">Email:</span> {{ u.email }}</p>
          <p><span class="text-text2">Role:</span> {{ u.role }}</p>
        </div>
      }
      <button
        (click)="logout()"
        class="w-full py-3 border border-border hover:bg-surface text-text text-sm font-semibold rounded-xl transition-colors"
      >
        Sign out
      </button>
    </div>
  </div>
</main>
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```
Expected: PASS. Not yet imported by `app.routes.ts` (Task 10 wires it) — just
needs to compile cleanly standalone.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/settings
git commit -m "feat: add SettingsComponent"
```

---

### Task 9: AnalyticsComponent (EMI Planner tile)

**Files:**
- Create: `src/app/pages/apps/emi-planner/analytics/analytics.component.ts`
- Create: `src/app/pages/apps/emi-planner/analytics/analytics.component.html`

**Interfaces:**
- Consumes: `AnalyticsService`, `AnalyticsSummary` (Task 3).
- Produces: `AnalyticsComponent` — consumed by `app.routes.ts` (Task 10) at path
  `apps/emi-planner/analytics`.

- [ ] **Step 1: Create the `.ts` file**

```ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AnalyticsService } from '../../../../core/services/analytics.service';
import { AnalyticsSummary } from '../../../../models/analytics.model';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './analytics.component.html',
})
export class AnalyticsComponent implements OnInit {
  private readonly analytics = inject(AnalyticsService);
  private readonly meta = inject(Meta);

  readonly summary = signal<AnalyticsSummary | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly emiPlannerEvents = signal(0);

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.analytics.summary(30).subscribe({
      next: (s) => {
        this.summary.set(s);
        this.emiPlannerEvents.set(
          s.byApp.find((a) => a.appSlug === 'emi-planner')?.count ?? 0,
        );
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load analytics.');
        this.loading.set(false);
      },
    });
  }
}
```

- [ ] **Step 2: Create the `.html` file**

```html
<main class="min-h-screen bg-bg text-text">
  <header class="border-b border-border">
    <div class="max-w-[1800px] mx-auto px-6 lg:px-8 py-4 flex items-center justify-between">
      <h1 class="text-lg font-bold">
        <span class="gradient-text">EMI Planner</span> Analytics
      </h1>
      <a
        routerLink="/"
        class="text-sm text-text2 hover:text-text border border-border hover:bg-surface rounded-xl px-4 py-2 transition-colors"
      >
        ← All apps
      </a>
    </div>
  </header>

  <div class="max-w-[1800px] mx-auto px-6 lg:px-8 py-10 space-y-6">
    @if (loading()) {
      <p class="text-text2 text-sm">Loading…</p>
    } @else if (loadError()) {
      <p class="text-danger text-sm">{{ loadError() }}</p>
    } @else if (summary(); as s) {
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div class="bg-card border border-border rounded-3xl p-6">
          <p class="text-text2 text-xs uppercase tracking-wide mb-2">EMI Planner events (last {{ s.rangeDays }}d)</p>
          <p class="text-3xl font-bold">{{ emiPlannerEvents() }}</p>
        </div>
        <div class="bg-card border border-border rounded-3xl p-6">
          <p class="text-text2 text-xs uppercase tracking-wide mb-2">Unique visitors (site-wide)</p>
          <p class="text-3xl font-bold">{{ s.uniqueVisitors }}</p>
        </div>
        <div class="bg-card border border-border rounded-3xl p-6">
          <p class="text-text2 text-xs uppercase tracking-wide mb-2">Total events (site-wide)</p>
          <p class="text-3xl font-bold">{{ s.totalEvents }}</p>
        </div>
      </div>
      <p class="text-text2 text-xs">
        Per-app breakdowns (countries, devices, browsers) aren't available yet —
        the backend currently only filters event counts by app, not the other
        dimensions.
      </p>
    }
  </div>
</main>
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```
Expected: PASS. Not yet imported by `app.routes.ts` (Task 10 wires it) — just
needs to compile cleanly standalone.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/apps/emi-planner
git commit -m "feat: add AnalyticsComponent (EMI Planner tile)"
```

---

### Task 10: Wire routes, update login redirect, final verification

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/pages/auth/login/login.component.ts`

**Interfaces:**
- Consumes: `HomeComponent` (Task 7), `SettingsComponent` (Task 8),
  `AdminDashboardComponent`/`AdminArticleComponent`/`AdminPushComponent`
  (Tasks 4-6, now under `pages/apps/vamaha/`), `AnalyticsComponent` (Task 9).
- Produces: the fully wired shell — final deliverable of this plan.
- This is the single cutover task: it deletes the old `src/app/pages/admin/`
  tree (superseded by Tasks 4-6's `pages/apps/vamaha/` copies) and repoints
  every route in the same commit, so the build is never broken partway through.

- [ ] **Step 1: Delete the old `pages/admin/` tree**

```bash
cd c:/project2/vamaha-workspace/vamaha-www
rm -rf src/app/pages/admin
```

- [ ] **Step 2: Replace `app.routes.ts`**

```ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/settings/settings.component').then(m => m.SettingsComponent),
  },
  {
    path: 'apps/vamaha',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/apps/vamaha/admin-dashboard/admin-dashboard.component').then(
        m => m.AdminDashboardComponent,
      ),
  },
  {
    path: 'apps/vamaha/articles/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/apps/vamaha/admin-article/admin-article.component').then(
        m => m.AdminArticleComponent,
      ),
  },
  {
    path: 'apps/vamaha/push',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/apps/vamaha/admin-push/admin-push.component').then(
        m => m.AdminPushComponent,
      ),
  },
  {
    path: 'apps/emi-planner/analytics',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/apps/emi-planner/analytics/analytics.component').then(
        m => m.AnalyticsComponent,
      ),
  },
  { path: '**', redirectTo: '' },
];
```

- [ ] **Step 3: Update `login.component.ts`'s two redirect targets**

Change both occurrences of `['/admin']` to `['/']` (the tile-home screen is now
the post-login destination, not the Vamaha dashboard directly):

```ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);

  email = '';
  password = '';
  readonly status = signal<'idle' | 'submitting' | 'error'>('idle');
  readonly error = signal<string>('');

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    if (this.auth.isLoggedIn()) void this.router.navigate(['/']);
  }

  async submit(): Promise<void> {
    if (this.status() === 'submitting') return;
    this.status.set('submitting');
    this.error.set('');
    try {
      await this.auth.login(this.email.trim(), this.password);
      await this.router.navigate(['/']);
    } catch (err: unknown) {
      this.status.set('error');
      this.error.set(this.messageFor(err));
    }
  }

  private messageFor(err: unknown): string {
    const status = (err as { status?: number })?.status;
    if (status === 401) return 'Invalid email or password.';
    if (status === 0) return 'Cannot reach the server. Try again shortly.';
    return 'Something went wrong. Please try again.';
  }
}
```

(`login.component.html` is unchanged — no path references there.)

- [ ] **Step 4: Full verification**

```bash
cd c:/project2/vamaha-workspace/vamaha-www
npx tsc --noEmit
npx ng build
```
Expected: both succeed with zero errors. Confirm the build output lists lazy
chunks for: home, settings, admin-dashboard, admin-article, admin-push, analytics
(6 lazy chunks total), and that `src/app/pages/admin/` no longer exists on disk
(deleted in Step 1 of this task).

- [ ] **Step 5: Fresh-server manual verification**

```bash
npx ng serve --port 4402
```
Open `http://localhost:4402` in a **hard-refreshed** browser tab (a stale
dev-server cache was mistaken for a real bug once already in this project — always
start fresh and hard-refresh before judging). Confirm:
- Unauthenticated: redirected to `/login`.
- After login with real credentials: lands on `/` showing two tiles (Vamaha,
  EMI Planner) plus a Settings link in the header — not the old direct-to-dashboard
  behavior.
- Vamaha tile → `/apps/vamaha` dashboard loads exactly as before (article list,
  write/generate forms).
- From the dashboard, "Push Notifications" link → `/apps/vamaha/push` loads.
- Opening an article → `/apps/vamaha/articles/:id`, editor loads, "← Dashboard"
  link returns to `/apps/vamaha`, "View live →" (if published) opens
  `vamaha.tech/learn/<slug>` in a new tab.
- EMI Planner tile → `/apps/emi-planner/analytics` loads, shows real numbers (or
  zeros) from `/analytics/summary`, no console errors.
- Settings link → `/settings` shows name/email/role, "← All apps" returns to `/`,
  "Sign out" returns to `/login`.
- Deep-linking directly to `/settings` or `/apps/emi-planner/analytics` (paste
  URL, refresh) works without a 404 (the existing `vercel.json` catch-all rewrite
  only helps in production — for `ng serve` this just confirms Angular's own
  routing handles it, which it should since `outputMode` isn't static for this app).

- [ ] **Step 6: Commit**

```bash
cd c:/project2/vamaha-workspace/vamaha-www
git add -A
git commit -m "$(cat <<'EOF'
feat: wire admin shell — tile-home, settings, apps/* routing

Login now lands on a tile grid instead of the Vamaha dashboard
directly. Existing Vamaha admin moved under /apps/vamaha/*, new EMI
Planner analytics tile added under /apps/emi-planner/*. Per
docs/superpowers/specs/2026-08-02-admin-shell-design.md.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Post-plan (not part of this plan's tasks)

- Verdiq admin migration (12 feature areas, separate backend/auth) — future spec,
  once this shell pattern is proven in production.
- Backend `appSlug` filtering for `/analytics/summary` — once EMI Planner has real
  traffic worth breaking down by country/device/browser.
- App-registry editing UI in Settings, if the registry grows enough to need one.
