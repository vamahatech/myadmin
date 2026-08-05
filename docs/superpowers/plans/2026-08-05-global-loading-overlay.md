# Global API Loading Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a global, dimmed, blocking loading overlay with a dual-ring spinner whenever any HTTP request is in flight, without per-page wiring.

**Architecture:** A signal-based `LoadingService` tracks an in-flight-request counter. An `HttpInterceptorFn` increments/decrements it around every request. A single `LoadingOverlayComponent`, mounted once in `app.html`, reads the service and shows/hides itself with anti-flicker timing (150ms show-delay, 300ms minimum visible duration).

**Tech Stack:** Angular (standalone components, signals, `HttpInterceptorFn`), Tailwind + existing CSS custom properties (`--color-primary`, `--color-accent`) from `src/styles/colors.css`.

## Global Constraints

- Colors must come from existing tokens (`--color-primary`, `--color-accent`, `--color-bg`) — never hardcode hex values (per `src/styles/colors.css` header comment).
- Overlay must work in both light and dark mode (`html.dark` token overrides).
- No external libraries/assets — pure CSS/SVG animation.
- Follow existing interceptor pattern (`src/app/core/interceptors/auth.interceptor.ts`) — plain `HttpInterceptorFn`, registered in `app.config.ts`.

---

### Task 1: LoadingService

**Files:**
- Create: `src/app/core/services/loading.service.ts`

**Interfaces:**
- Produces: `LoadingService` class with:
  - `activeRequests: WritableSignal<number>` (private setter, exposed read via `isLoading`)
  - `isLoading: Signal<boolean>` — `computed(() => this.activeRequests() > 0)`
  - `start(): void` — increments `activeRequests`
  - `stop(): void` — decrements `activeRequests`, floored at 0

- [ ] **Step 1: Write the service**

```typescript
import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly activeRequests = signal(0);
  readonly isLoading = computed(() => this.activeRequests() > 0);

  start(): void {
    this.activeRequests.update((n) => n + 1);
  }

  stop(): void {
    this.activeRequests.update((n) => Math.max(0, n - 1));
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors referencing `loading.service.ts`

- [ ] **Step 3: Commit**

```bash
git add src/app/core/services/loading.service.ts
git commit -m "feat: add LoadingService for tracking in-flight HTTP requests"
```

---

### Task 2: loadingInterceptor

**Files:**
- Create: `src/app/core/interceptors/loading.interceptor.ts`
- Modify: `src/app/app.config.ts:1-14`

**Interfaces:**
- Consumes: `LoadingService.start()`, `LoadingService.stop()` (from Task 1)
- Produces: `loadingInterceptor: HttpInterceptorFn`, registered in `provideHttpClient(withInterceptors([...]))`

- [ ] **Step 1: Write the interceptor**

```typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

/**
 * Tracks in-flight HTTP requests so LoadingOverlayComponent can show/hide
 * globally without any per-page wiring.
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loading = inject(LoadingService);
  loading.start();
  return next(req).pipe(finalize(() => loading.stop()));
};
```

- [ ] **Step 2: Register it in app.config.ts**

Modify `src/app/app.config.ts`:

```typescript
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { verdiqAuthInterceptor } from './core/interceptors/verdiq-auth.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, verdiqAuthInterceptor, loadingInterceptor])),
    provideRouter(routes),
  ],
};
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add src/app/core/interceptors/loading.interceptor.ts src/app/app.config.ts
git commit -m "feat: wire loadingInterceptor into HttpClient providers"
```

---

### Task 3: LoadingOverlayComponent

**Files:**
- Create: `src/app/shared/components/loading-overlay/loading-overlay.component.ts`
- Create: `src/app/shared/components/loading-overlay/loading-overlay.component.html`
- Modify: `src/app/app.ts:1-10`
- Modify: `src/app/app.html:1`

**Interfaces:**
- Consumes: `LoadingService.isLoading` (Signal<boolean>, from Task 1)
- Produces: `<app-loading-overlay />` standalone component, selector `app-loading-overlay`

- [ ] **Step 1: Write the component class**

```typescript
import { Component, effect, inject, signal } from '@angular/core';
import { LoadingService } from '../../../core/services/loading.service';

const SHOW_DELAY_MS = 150;
const MIN_VISIBLE_MS = 300;

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  templateUrl: './loading-overlay.component.html',
})
export class LoadingOverlayComponent {
  private readonly loading = inject(LoadingService);
  readonly visible = signal(false);

  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private shownAt = 0;

  constructor() {
    effect(() => {
      const isLoading = this.loading.isLoading();
      if (isLoading) {
        this.cancelHide();
        if (!this.visible() && !this.showTimer) {
          this.showTimer = setTimeout(() => {
            this.showTimer = null;
            this.shownAt = Date.now();
            this.visible.set(true);
          }, SHOW_DELAY_MS);
        }
      } else {
        this.cancelShow();
        if (this.visible()) {
          const elapsed = Date.now() - this.shownAt;
          const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
          this.hideTimer = setTimeout(() => {
            this.hideTimer = null;
            this.visible.set(false);
          }, remaining);
        }
      }
    });
  }

  private cancelShow(): void {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
  }

  private cancelHide(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}
```

- [ ] **Step 2: Write the template**

```html
@if (visible()) {
  <div
    class="fixed inset-0 z-[9999] flex items-center justify-center bg-bg/70 backdrop-blur-[1px]"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <span class="sr-only">Loading…</span>
    <div class="loading-dual-ring" aria-hidden="true"></div>
  </div>
}
```

- [ ] **Step 3: Add the dual-ring spinner CSS**

Append to `src/styles.css`:

```css
.loading-dual-ring {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 4px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-right-color: var(--color-accent);
  animation: loading-dual-ring-spin 0.8s linear infinite;
}

@keyframes loading-dual-ring-spin {
  to {
    transform: rotate(360deg);
  }
}
```

- [ ] **Step 4: Mount the overlay at the app root**

Modify `src/app/app.ts`:

```typescript
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoadingOverlayComponent } from './shared/components/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LoadingOverlayComponent],
  templateUrl: './app.html',
})
export class App {}
```

Modify `src/app/app.html`:

```html
<router-outlet />
<app-loading-overlay />
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors

- [ ] **Step 6: Manual verification**

Run: `npm start` (or existing dev script), open the app, log in, and confirm:
- Overlay appears during the login API call, dims background, blocks clicks
- Spinner rotates, uses green/gold theme colors, matches dark mode when toggled
- Overlay disappears shortly after response without a visible flicker on fast responses

- [ ] **Step 7: Commit**

```bash
git add src/app/shared/components/loading-overlay/loading-overlay.component.ts src/app/shared/components/loading-overlay/loading-overlay.component.html src/app/app.ts src/app/app.html src/styles.css
git commit -m "feat: add global loading overlay with dual-ring spinner"
```
