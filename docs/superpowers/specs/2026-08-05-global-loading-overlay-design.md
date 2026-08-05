# Global API Loading Overlay

## Problem

API requests currently give no visual feedback while in flight. Users can
double-submit forms or think the app has frozen during slower calls. We want
one shared loading indicator that appears automatically for any HTTP request,
without per-page wiring.

## Approach

A signal-based `LoadingService` tracks the number of in-flight HTTP requests.
An `HttpInterceptorFn` increments/decrements that counter around every
request. A single `LoadingOverlayComponent`, mounted once at the app root,
reads the service and shows/hides itself — so every page gets the behavior
for free.

### Components

- **`core/services/loading.service.ts`**
  - `activeRequests: WritableSignal<number>`
  - `isLoading: Signal<boolean>` — computed as `activeRequests() > 0`
  - `start()` / `stop()` methods to increment/decrement the counter
    (`stop()` floors at 0 defensively).

- **`core/interceptors/loading.interceptor.ts`**
  - `HttpInterceptorFn` that calls `loadingService.start()` before
    `next(req)` and `loadingService.stop()` in `finalize()`, so it fires on
    success, error, and cancellation alike.
  - Applies to all HTTP requests (consistent with how `authInterceptor` and
    `verdiqAuthInterceptor` are globally registered today).
  - Registered in `app.config.ts`'s `withInterceptors([...])` list.

- **`shared/components/loading-overlay/loading-overlay.component.ts`**
  - Standalone component with no inputs; injects `LoadingService` directly.
  - Renders a fixed, full-viewport, dimmed backdrop with a centered dual-ring
    spinner (pure CSS/SVG, styled with `--color-primary` / `--color-accent`
    tokens so it adapts to dark mode automatically).
  - `role="status"`, `aria-live="polite"`, `aria-busy="true"` while visible,
    plus visually-hidden "Loading…" text for screen readers.
  - High `z-index`, captures pointer events while visible to block
    interaction underneath (prevents double-submits during in-flight calls).
  - Mounted once in `app.html` next to `<router-outlet />`.

### Anti-flicker behavior

To avoid a visible flash on fast/cached responses:
- The overlay only becomes visible if a request is still pending ~150ms
  after `isLoading` turns true (show-delay).
- Once shown, it stays visible for a minimum of ~300ms even if the request
  finishes sooner (minimum visible duration).

This is implemented inside `LoadingOverlayComponent` using `effect()` +
`setTimeout`, not in the service — the service just reports raw in-flight
state; the component owns the presentation timing.

## Out of scope

- Per-request opt-out (e.g. silent background polling that shouldn't show
  the overlay) — not currently needed since there's no polling in the app.
  If it's needed later, it can be added via an `HttpContext` token read by
  the interceptor.
- Progress percentage / determinate progress — the API doesn't expose
  upload/download progress needs beyond a busy indicator.

## Testing

- Manual: trigger a login (or any admin API call) and confirm the overlay
  appears, blocks clicks, and disappears after response; confirm dark mode
  styling; confirm no flicker on fast local responses.
