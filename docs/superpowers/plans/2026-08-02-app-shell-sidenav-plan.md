# App Shell Side-Nav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every app inside the admin shell a shared side-nav layout (`AppShellComponent`) so each app's features live under one consistent sidebar instead of duplicated ad-hoc top bars.

**Architecture:** One new standalone `AppShellComponent` renders a sidebar (app mark, nav items, settings/sign-out) and a `<router-outlet>`. `apps/vamaha` and `apps/emi-planner` become parent routes using `AppShellComponent`, with their feature pages as child routes. `apps/vamaha/articles/:id` (the article editor) stays a sibling route outside the shell — it's a full-bleed writing surface with its own sticky action bar and "← Dashboard" link, and embedding it under the sidebar would shrink its writing width for no benefit; the design spec's list of components that lose their own header markup does not include it.

**Tech Stack:** Angular 21 standalone components, Angular Router child routes, Tailwind CSS v3.

## Global Constraints

- This project has no unit test suite (`find src -name "*.spec.ts"` returns nothing) — verification is `npx tsc --noEmit -p tsconfig.app.json` and `npx ng build`, both run from `vamaha-www/`, per this project's established convention.
- Before eyeballing any UI change in a browser, start a **fresh** `ng serve` (or fresh build) — a stale dev server/browser cache has previously been mistaken for a real styling bug in this project.
- No new npm dependencies.
- Color/spacing classes must match the existing Studio Ledger visual language already in the app: `bg-bg`, `bg-surface`, `text-text`, `text-text2`, `border-border`, `text-primary`, the `.ink-seal` mark — never hardcode a hex value (see `src/styles/colors.css` header comment).
- `apps/vamaha/articles/:id` (`AdminArticleComponent`) is explicitly **out of scope** for header/shell changes — do not modify it.
- The `verdiq` entry already present in `src/app/core/models/app-registry.model.ts` stays as-is and unwired to a real route — do not add an `apps/verdiq` route in this plan.

---

### Task 1: Create AppShellComponent

**Files:**
- Create: `src/app/shared/components/app-shell/app-shell.component.ts`
- Create: `src/app/shared/components/app-shell/app-shell.component.html`

**Interfaces:**
- Produces: `AppShellNavItem` interface (`{ label: string; icon: string; path: string }`), exported from `app-shell.component.ts`. Task 2 (route data) and any future app relies on this exact shape.
- Consumes: `AuthService` (`src/app/core/services/auth.service.ts`) — `auth.user()` signal (`AuthUser | null`, fields `name`/`role`) and `auth.logout()`. Reads `appName: string`, `appIcon: string`, `navItems: AppShellNavItem[]` from its own `ActivatedRoute.snapshot.data`.

- [ ] **Step 1: Write `app-shell.component.ts`**

```ts
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

export interface AppShellNavItem {
  label: string;
  icon: string;
  path: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-shell.component.html',
})
export class AppShellComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly appName = this.route.snapshot.data['appName'] as string;
  readonly appIcon = this.route.snapshot.data['appIcon'] as string;
  readonly navItems = this.route.snapshot.data['navItems'] as AppShellNavItem[];
  readonly appInitial = this.appName.charAt(0).toUpperCase();

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
```

- [ ] **Step 2: Write `app-shell.component.html`**

```html
<div class="min-h-screen flex flex-col md:flex-row bg-bg text-text">
  <aside class="border-b md:border-b-0 md:border-r border-border md:w-64 md:shrink-0 flex flex-col">
    <a
      routerLink="/"
      class="flex items-center gap-3 px-6 py-5 border-b border-border hover:bg-surface transition-colors"
    >
      <span class="ink-seal text-primary w-8 h-8 text-base">{{ appInitial }}</span>
      <span class="flex items-center gap-2 min-w-0">
        <span class="text-lg shrink-0">{{ appIcon }}</span>
        <span class="text-base font-bold truncate">{{ appName }}</span>
      </span>
    </a>

    <nav class="flex md:flex-col overflow-x-auto md:overflow-visible px-3 py-3 md:py-4 gap-1">
      @for (item of navItems; track item.path) {
        <a
          [routerLink]="item.path"
          routerLinkActive="bg-surface text-primary"
          [routerLinkActiveOptions]="{ exact: item.path === '' }"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-text2 hover:text-text hover:bg-surface transition-colors whitespace-nowrap"
        >
          <span class="text-base">{{ item.icon }}</span>
          {{ item.label }}
        </a>
      }
    </nav>

    <div class="md:mt-auto px-3 py-4 border-t border-border">
      @if (auth.user(); as u) {
        <p class="px-3 text-xs text-text2 mb-2 truncate">{{ u.name }} · {{ u.role }}</p>
      }
      <a
        routerLink="/settings"
        class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-text2 hover:text-text hover:bg-surface transition-colors"
      >
        Settings
      </a>
      <button
        (click)="logout()"
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-text2 hover:text-text hover:bg-surface transition-colors text-left"
      >
        Sign out
      </button>
    </div>
  </aside>

  <main class="flex-1 min-w-0">
    <router-outlet></router-outlet>
  </main>
</div>
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json` (from `vamaha-www/`)
Expected: PASS, no errors. (The component isn't referenced by any route yet, so this only checks it's syntactically and structurally valid on its own.)

- [ ] **Step 4: Commit**

```bash
git add src/app/shared/components/app-shell/
git commit -m "feat: add AppShellComponent for per-app side navigation"
```

---

### Task 2: Wire apps/vamaha and apps/emi-planner through AppShellComponent

**Files:**
- Modify: `src/app/app.routes.ts` (full replacement below)

**Interfaces:**
- Consumes: `AppShellComponent` from Task 1, plus route `data.navItems: AppShellNavItem[]` shape from Task 1.
- Produces: no change to any external URL — `/apps/vamaha`, `/apps/vamaha/push`, `/apps/vamaha/articles/:id`, `/apps/emi-planner/analytics` all resolve to the exact same paths as before, so `APP_REGISTRY` in `app-registry.model.ts` needs no changes.

- [ ] **Step 1: Replace `src/app/app.routes.ts` in full**

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
      import('./shared/components/app-shell/app-shell.component').then(
        m => m.AppShellComponent,
      ),
    data: {
      appName: 'Vamaha',
      appIcon: '📝',
      navItems: [
        { label: 'Articles', icon: '📰', path: '' },
        { label: 'Push notifications', icon: '🔔', path: 'push' },
      ],
    },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/apps/vamaha/admin-dashboard/admin-dashboard.component').then(
            m => m.AdminDashboardComponent,
          ),
      },
      {
        path: 'push',
        loadComponent: () =>
          import('./pages/apps/vamaha/admin-push/admin-push.component').then(
            m => m.AdminPushComponent,
          ),
      },
    ],
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
    path: 'apps/emi-planner',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/components/app-shell/app-shell.component').then(
        m => m.AppShellComponent,
      ),
    data: {
      appName: 'EMI Planner',
      appIcon: '📊',
      navItems: [{ label: 'Analytics', icon: '📊', path: 'analytics' }],
    },
    children: [
      {
        path: 'analytics',
        loadComponent: () =>
          import('./pages/apps/emi-planner/analytics/analytics.component').then(
            m => m.AnalyticsComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
```

- [ ] **Step 2: Verify it compiles and builds**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: PASS.

Run: `npx ng build`
Expected: succeeds; separate lazy chunks exist for `AppShellComponent`, `AdminDashboardComponent`, `AdminPushComponent`, `AdminArticleComponent`, and `AnalyticsComponent`.

- [ ] **Step 3: Commit**

```bash
git add src/app/app.routes.ts
git commit -m "feat: nest Vamaha and EMI Planner feature routes under AppShellComponent"
```

---

### Task 3: Strip the old header out of AdminDashboardComponent

**Files:**
- Modify: `src/app/pages/apps/vamaha/admin-dashboard/admin-dashboard.component.html`
- Modify: `src/app/pages/apps/vamaha/admin-dashboard/admin-dashboard.component.ts`

**Interfaces:**
- Consumes: renders inside `AppShellComponent`'s `<router-outlet>` (Task 2) — the shell now owns app title, user display, settings link, and sign-out, so this component's own top bar is redundant and is removed.

- [ ] **Step 1: Replace `admin-dashboard.component.html` in full**

```html
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
```

- [ ] **Step 2: Replace `admin-dashboard.component.ts` in full**

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
  private readonly auth = inject(AuthService);
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

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/apps/vamaha/admin-dashboard/
git commit -m "refactor: remove AdminDashboardComponent's own header (now in AppShellComponent)"
```

---

### Task 4: Strip the old header out of AdminPushComponent

**Files:**
- Modify: `src/app/pages/apps/vamaha/admin-push/admin-push.component.html`
- Modify: `src/app/pages/apps/vamaha/admin-push/admin-push.component.ts`

**Interfaces:**
- Consumes: renders inside `AppShellComponent`'s `<router-outlet>` (Task 2), same as Task 3.

- [ ] **Step 1: Replace `admin-push.component.html` in full**

```html
<div class="min-h-screen bg-bg text-text">
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

- [ ] **Step 2: Replace `admin-push.component.ts` in full**

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
  private readonly auth = inject(AuthService);
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
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/apps/vamaha/admin-push/
git commit -m "refactor: remove AdminPushComponent's own header (now in AppShellComponent)"
```

---

### Task 5: Strip the old header out of AnalyticsComponent

**Files:**
- Modify: `src/app/pages/apps/emi-planner/analytics/analytics.component.html`
- Modify: `src/app/pages/apps/emi-planner/analytics/analytics.component.ts`

**Interfaces:**
- Consumes: renders inside `AppShellComponent`'s `<router-outlet>` (Task 2), same as Tasks 3-4.

- [ ] **Step 1: Replace `analytics.component.html` in full**

```html
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
```

- [ ] **Step 2: Replace `analytics.component.ts` in full**

```ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { AnalyticsService } from '../../../../core/services/analytics.service';
import { AnalyticsSummary } from '../../../../models/analytics.model';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [],
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

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/apps/emi-planner/analytics/
git commit -m "refactor: remove AnalyticsComponent's own header (now in AppShellComponent)"
```

---

### Task 6: Final build verification

**Files:** none (verification only)

- [ ] **Step 1: Full clean build**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: PASS.

Run: `npx ng build`
Expected: succeeds with no errors; chunks exist for `app-shell.component`, `admin-dashboard.component`, `admin-push.component`, `admin-article.component`, `analytics.component`.

- [ ] **Step 2: Manual smoke test on a freshly started server**

Run: `npx ng serve` (fresh start — do not reuse a server that was already running before this plan's changes)

Log in, then check:
- `/apps/vamaha` shows the sidebar with "Articles" (highlighted) and "Push notifications"; clicking "Push notifications" navigates to `/apps/vamaha/push` and highlights it instead.
- Opening an article from the Articles list goes to `/apps/vamaha/articles/:id` and shows the full-bleed editor with **no** sidebar (unchanged from before).
- `/apps/emi-planner/analytics` shows the sidebar with a single "Analytics" item.
- From inside either app, clicking the app name/mark at the top of the sidebar returns to `/` (tile-home).
- Settings and Sign out both work from the sidebar in both apps.

Expected: all of the above behave as described, with no visual regressions and no console errors.

- [ ] **Step 3: No commit needed** (verification only, nothing to stage)
