# Streamlined Article Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Split the admin article editor into a distraction-free writing view (title + body only, autosaving) and a Publish slide-over panel (excerpt, category, SEO, read-only details), matching Medium's writing flow.

**Architecture:** `admin-article.component` becomes a thin writing shell that owns all HTTP calls and autosave debouncing; a new standalone `publish-panel.component` (model-input based, presentation-only) renders the drawer and emits `saveDraft`/`publish`/`closed` events back to the parent.

**Tech Stack:** Angular 21 (standalone components, `model()`/`input()`/`output()`, `@angular/core/rxjs-interop`), RxJS `Subject` + `debounceTime` for autosave, existing `AdminContentService` (unchanged), existing `MarkdownEditorComponent` (unchanged).

## Global Constraints

- No backend or `Article` model changes — reuse existing fields only (per spec's "Out of scope").
- No reactive-forms conversion — keep the codebase's template-driven (`ngModel`) style.
- Colors/spacing must use existing Tailwind tokens (`bg-card`, `border-border`, `text-primary`, etc.) — never hardcode hex.
- Publish panel must work in dark mode (uses the same CSS custom properties as the rest of the app).

---

### Task 1: `PublishPanelComponent`

**Files:**
- Create: `src/app/shared/components/publish-panel/publish-panel.component.ts`
- Create: `src/app/shared/components/publish-panel/publish-panel.component.html`

**Interfaces:**
- Produces: `PublishPanelComponent`, selector `app-publish-panel`, with:
  - Two-way model inputs: `excerpt = model('')`, `excerptTe = model('')`, `seoTitle = model('')`, `seoDescription = model('')`, `category = model('update')`
  - Read-only inputs: `sources = input<string[]>([])`, `faq = input<{ question: string; answer: string }[] | null>(null)`, `author = input('')`, `updatedAt = input('')`, `status = input<'DRAFT' | 'IN_REVIEW' | 'PUBLISHED'>('DRAFT')`, `saving = input(false)`
  - Outputs: `closed = output<void>()`, `saveDraft = output<void>()`, `publish = output<void>()`

- [x] **Step 1: Write the component class**

```typescript
import { Component, input, model, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-publish-panel',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './publish-panel.component.html',
})
export class PublishPanelComponent {
  readonly excerpt = model('');
  readonly excerptTe = model('');
  readonly seoTitle = model('');
  readonly seoDescription = model('');
  readonly category = model('update');

  readonly sources = input<string[]>([]);
  readonly faq = input<{ question: string; answer: string }[] | null>(null);
  readonly author = input('');
  readonly updatedAt = input('');
  readonly status = input<'DRAFT' | 'IN_REVIEW' | 'PUBLISHED'>('DRAFT');
  readonly saving = input(false);

  readonly closed = output<void>();
  readonly saveDraft = output<void>();
  readonly publish = output<void>();
}
```

- [x] **Step 2: Write the template**

```html
<div class="fixed inset-0 z-30 flex justify-end">
  <div class="absolute inset-0 bg-text/40" (click)="closed.emit()"></div>

  <aside class="relative w-full max-w-md h-full bg-bg border-l border-border overflow-y-auto">
    <header class="sticky top-0 bg-bg/95 backdrop-blur border-b border-border px-6 py-4 flex items-center justify-between">
      <h2 class="text-sm font-semibold">Story settings</h2>
      <button type="button" (click)="closed.emit()" class="text-text2 hover:text-text text-sm transition-colors">
        Close ✕
      </button>
    </header>

    <div class="p-6 space-y-6">
      <div>
        <label for="panelExcerpt" class="block text-xs uppercase tracking-wide text-text2 mb-1.5">
          Excerpt <span class="normal-case tracking-normal text-text2">— the one-line summary in listings</span>
        </label>
        <textarea
          id="panelExcerpt" name="panelExcerpt" rows="2"
          [ngModel]="excerpt()" (ngModelChange)="excerpt.set($event)"
          class="w-full px-4 py-3 bg-surface border border-border rounded-xl text-text focus:outline-none focus:border-primary transition-colors text-sm"
        ></textarea>
      </div>

      <div>
        <label for="panelCategory" class="block text-xs uppercase tracking-wide text-text2 mb-1.5">Category</label>
        <input
          id="panelCategory" name="panelCategory"
          [ngModel]="category()" (ngModelChange)="category.set($event)"
          class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-text focus:outline-none focus:border-primary transition-colors text-sm"
        />
      </div>

      <div class="border-t border-border pt-6">
        <h3 class="text-xs uppercase tracking-wide text-text2 mb-3">Search &amp; social</h3>
        <div class="space-y-4">
          <div>
            <label for="panelSeoTitle" class="block text-xs uppercase tracking-wide text-text2 mb-1.5">SEO title</label>
            <input
              id="panelSeoTitle" name="panelSeoTitle"
              [ngModel]="seoTitle()" (ngModelChange)="seoTitle.set($event)"
              class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-text focus:outline-none focus:border-primary transition-colors text-sm"
            />
          </div>
          <div>
            <label for="panelSeoDescription" class="block text-xs uppercase tracking-wide text-text2 mb-1.5">SEO description</label>
            <textarea
              id="panelSeoDescription" name="panelSeoDescription" rows="3"
              [ngModel]="seoDescription()" (ngModelChange)="seoDescription.set($event)"
              class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-text focus:outline-none focus:border-primary transition-colors text-sm"
            ></textarea>
          </div>
        </div>
      </div>

      <div class="border-t border-border pt-6 space-y-4 text-sm">
        <h3 class="text-xs uppercase tracking-wide text-text2 mb-1">Details</h3>
        <div>
          <p class="text-text2 text-xs uppercase tracking-wide mb-0.5">Author</p>
          <p>{{ author() }}</p>
        </div>
        <div>
          <p class="text-text2 text-xs uppercase tracking-wide mb-0.5">Last updated</p>
          <p>{{ updatedAt() | date: 'medium' }}</p>
        </div>
        <div>
          <p class="text-text2 text-xs uppercase tracking-wide mb-1">Sources</p>
          @if (sources().length) {
            <ul class="space-y-1">
              @for (s of sources(); track s) {
                <li class="break-all text-primary text-xs">{{ s }}</li>
              }
            </ul>
          } @else {
            <p class="text-text2 text-xs">None</p>
          }
        </div>
        @if (faq()?.length) {
          <div>
            <p class="text-text2 text-xs uppercase tracking-wide mb-1">FAQ ({{ faq()?.length }})</p>
            <ul class="space-y-2">
              @for (f of faq(); track f.question) {
                <li>
                  <p class="font-medium">{{ f.question }}</p>
                  <p class="text-text2 text-xs">{{ f.answer }}</p>
                </li>
              }
            </ul>
          </div>
        }
      </div>
    </div>

    <footer class="sticky bottom-0 bg-bg/95 backdrop-blur border-t border-border px-6 py-4 flex items-center gap-3">
      <button
        type="button" (click)="saveDraft.emit()" [disabled]="saving()"
        class="flex-1 py-2.5 px-4 border border-border hover:bg-surface disabled:opacity-50 text-text text-sm font-semibold rounded-xl transition-colors"
      >
        {{ saving() ? 'Saving…' : 'Save draft' }}
      </button>
      @if (status() !== 'PUBLISHED') {
        <button
          type="button" (click)="publish.emit()" [disabled]="saving()"
          class="flex-1 py-2.5 px-4 bg-success hover:opacity-90 disabled:opacity-50 text-bg text-sm font-semibold rounded-xl transition-opacity"
        >
          Publish
        </button>
      }
    </footer>
  </aside>
</div>
```

- [x] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors

- [x] **Step 4: Commit**

```bash
git add src/app/shared/components/publish-panel/publish-panel.component.ts src/app/shared/components/publish-panel/publish-panel.component.html
git commit -m "feat: add PublishPanelComponent for article story settings"
```

---

### Task 2: Rewrite `admin-article.component` writing view + autosave

**Files:**
- Modify: `src/app/pages/apps/vamaha/admin-article/admin-article.component.ts` (full rewrite)
- Modify: `src/app/pages/apps/vamaha/admin-article/admin-article.component.html` (full rewrite)

**Interfaces:**
- Consumes: `PublishPanelComponent` (Task 1) via `<app-publish-panel [(excerpt)]="excerpt" ... (closed)="panelOpen.set(false)" (saveDraft)="save()" (publish)="publish()" />`
- Produces: same public behavior as before (load/save/publish against `AdminContentService`), plus `panelOpen: WritableSignal<boolean>` and `autosaveStatus: WritableSignal<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>`

- [x] **Step 1: Write the new component class**

```typescript
import { Component, DestroyRef, inject, signal, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { Subject, debounceTime } from 'rxjs';
import { AdminContentService } from '../../../../core/services/admin-content.service';
import { Article } from '../../../../models/article.model';
import { MarkdownEditorComponent } from '../../../../shared/components/markdown-editor/markdown-editor.component';
import { PublishPanelComponent } from '../../../../shared/components/publish-panel/publish-panel.component';
import { environment } from '../../../../../environments/environment';

const AUTOSAVE_DEBOUNCE_MS = 2000;

@Component({
  selector: 'app-admin-article',
  standalone: true,
  imports: [FormsModule, RouterLink, MarkdownEditorComponent, PublishPanelComponent],
  templateUrl: './admin-article.component.html',
})
export class AdminArticleComponent implements OnInit {
  private readonly admin = inject(AdminContentService);
  private readonly route = inject(ActivatedRoute);
  private readonly meta = inject(Meta);
  private readonly destroyRef = inject(DestroyRef);

  readonly siteUrl = environment.siteUrl;

  private id = '';
  readonly article = signal<Article | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal('');

  readonly lang = signal<'en' | 'te'>('en');
  readonly panelOpen = signal(false);

  title = '';
  excerpt = '';
  bodyMd = '';
  titleTe = '';
  excerptTe = '';
  bodyMdTe = '';
  seoTitle = '';
  seoDescription = '';
  category = 'update';

  readonly autosaveStatus = signal<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  readonly publishStatus = signal<'idle' | 'publishing' | 'error'>('idle');
  readonly actionError = signal('');

  private readonly dirty$ = new Subject<void>();

  constructor() {
    this.dirty$.pipe(debounceTime(AUTOSAVE_DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.save();
    });
  }

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  markDirty(): void {
    this.autosaveStatus.set('dirty');
    this.dirty$.next();
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
    if (this.autosaveStatus() === 'saving') return;
    this.autosaveStatus.set('saving');
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
        category: this.category.trim() || 'update',
      })
      .subscribe({
        next: (a) => {
          this.apply(a);
          this.autosaveStatus.set('saved');
        },
        error: (err: unknown) => {
          this.autosaveStatus.set('error');
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
        this.panelOpen.set(false);
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
    this.category = a.category;
  }

  private messageFor(err: unknown): string {
    const status = (err as { status?: number })?.status;
    if (status === 401) return 'Your session expired. Please sign in again.';
    return 'Action failed. Please try again.';
  }
}
```

Note: `excerptTe`/`category` were not previously sent by `update()` — `category` is now included since the publish panel edits it; `excerptTe` was already sent. This matches `Partial<Article>` on `AdminContentService.update()`, no service change needed.

- [x] **Step 2: Write the new template**

```html
<main class="min-h-screen bg-bg text-text">
  <header class="sticky top-0 z-20 bg-bg/85 backdrop-blur border-b border-border">
    <div class="w-full px-6 lg:px-8 py-3 flex items-center gap-4">
      <a routerLink="/apps/vamaha" class="shrink-0 text-sm text-text2 hover:text-text transition-colors">
        ← Dashboard
      </a>

      @if (article(); as a) {
        <div class="min-w-0 flex-1 flex items-center gap-3">
          <span
            class="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full"
            [class.bg-success]="a.status === 'PUBLISHED'"
            [class.text-bg]="a.status === 'PUBLISHED'"
            [class.bg-surface]="a.status !== 'PUBLISHED'"
            [class.text-text2]="a.status !== 'PUBLISHED'"
            [class.border]="a.status !== 'PUBLISHED'"
            [class.border-border]="a.status !== 'PUBLISHED'"
          >{{ a.status }}</span>

          @switch (autosaveStatus()) {
            @case ('dirty') { <span class="text-text2 text-xs">Unsaved changes</span> }
            @case ('saving') { <span class="text-text2 text-xs">Saving…</span> }
            @case ('saved') { <span class="text-success text-xs">Saved ✓</span> }
            @case ('error') { <span class="text-danger text-xs">Error saving</span> }
          }
        </div>

        <div class="shrink-0 flex items-center gap-2.5">
          @if (a.status === 'PUBLISHED') {
            <a
              [href]="siteUrl + '/learn/' + a.slug"
              target="_blank"
              rel="noopener"
              class="py-2 px-4 text-primary hover:text-accent text-sm font-semibold transition-colors"
            >View live →</a>
          }
          <button
            type="button" (click)="panelOpen.set(true)"
            class="py-2 px-4 bg-primary hover:bg-accent text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Publish
          </button>
        </div>
      }
    </div>
  </header>

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

      <div class="flex flex-wrap items-center gap-3 mb-8 max-w-3xl mx-auto">
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

      <div class="max-w-3xl mx-auto space-y-6">
        @if (lang() === 'en') {
          <input
            name="title" [ngModel]="title" (ngModelChange)="title = $event; markDirty()"
            placeholder="What a repo-rate cut really does to your EMI"
            class="w-full text-4xl font-display font-bold placeholder:text-text2/60 placeholder:font-normal bg-transparent border-0 focus:outline-none"
          />
          <app-markdown-editor
            [value]="bodyMd" (valueChange)="bodyMd = $event; markDirty()"
            height="640px" placeholder="Write the article in Markdown…"
          />
        } @else {
          <input
            name="titleTe" [ngModel]="titleTe" (ngModelChange)="titleTe = $event; markDirty()"
            placeholder="శీర్షిక"
            class="w-full text-4xl font-display font-bold placeholder:text-text2/60 placeholder:font-normal bg-transparent border-0 focus:outline-none"
          />
          <app-markdown-editor
            [value]="bodyMdTe" (valueChange)="bodyMdTe = $event; markDirty()"
            height="640px" placeholder="తెలుగులో వ్యాసం రాయండి…"
          />
        }
      </div>

      @if (panelOpen()) {
        <app-publish-panel
          [(excerpt)]="excerpt"
          [(excerptTe)]="excerptTe"
          [(seoTitle)]="seoTitle"
          [(seoDescription)]="seoDescription"
          [(category)]="category"
          [sources]="a.sources"
          [faq]="a.faq ?? null"
          [author]="a.author"
          [updatedAt]="a.updatedAt"
          [status]="a.status"
          [saving]="autosaveStatus() === 'saving'"
          (closed)="panelOpen.set(false)"
          (saveDraft)="save()"
          (publish)="publish()"
        />
      }
    }
  </div>
</main>
```

Note: `[(excerpt)]="excerpt"` etc. work with plain (non-signal) parent properties — Angular's two-way binding syntax desugars to `[excerpt]="excerpt" (excerptChange)="excerpt = $event"`, which is valid on any assignable expression, not just signals. Panel edits won't trigger `markDirty()` automatically since they don't go through `(ngModelChange)`; that's acceptable per spec — "Save draft" in the panel saves immediately regardless of dirty state.

- [x] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors

- [x] **Step 4: Manual verification**

Run: `npm start`, open an existing draft article, confirm:
- Writing view shows only language toggle + title + body (no SEO/details visible)
- Typing in title or body shows "Unsaved changes" then "Saving…" then "Saved ✓" without clicking anything
- "Publish" button opens the slide-over panel with excerpt/category/SEO/details
- Editing excerpt in the panel and clicking "Save draft" persists it (reload page to confirm)
- Clicking "Publish" in the panel still shows the confirm dialog and behaves as before
- Dark mode: toggle dark mode and confirm the panel and title input are readable

- [x] **Step 5: Commit**

```bash
git add src/app/pages/apps/vamaha/admin-article/admin-article.component.ts src/app/pages/apps/vamaha/admin-article/admin-article.component.html
git commit -m "feat: split article editor into distraction-free writing view + publish panel"
```
