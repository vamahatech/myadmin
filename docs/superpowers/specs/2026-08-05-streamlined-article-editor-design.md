# Streamlined Article Editor (Medium-style)

## Problem

The admin article editor (`admin-article.component`) puts everything on one
long scrolling page: title, excerpt, body, SEO fields, and read-only details
all compete for attention at once, and saving is a manual click. This is
confusing to write in — the primary task (writing) is buried among secondary
tasks (SEO, metadata).

## Approach

Split the editor into two surfaces, matching Medium's writing flow:

1. **Writing view** (the main `admin-article` page) — just the language
   toggle, a large borderless title input, and the markdown body editor.
   Nothing else. Autosaves as you type.
2. **Publish panel** (new slide-over component) — everything that isn't
   "just writing": excerpt, category, SEO title/description, and read-only
   Sources/FAQ/author/updated-at. Opened via a "Publish" button in the
   writing view's top bar; closed via an explicit close button or Escape.

No backend or `Article` model changes — same fields as today, relocated in
the UI only.

### Components

- **`pages/apps/vamaha/admin-article/admin-article.component.ts`** (rewritten)
  - Top bar: back link, title/status badge, autosave status text
    (`Unsaved` / `Saving…` / `Saved`), and a "Publish" button that opens the
    panel (or "View live →" once `status === 'PUBLISHED'`).
  - Body: EN/తెలుగు language toggle + large title `<input>` (font-serif,
    borderless, Medium-style) + `<app-markdown-editor>` for the body,
    full width, no card wrapper.
  - Keeps existing signals: `article`, `loading`, `loadError`, `lang`,
    `actionError`. Replaces `saveStatus: 'idle'|'saving'|'saved'|'error'`
    with the same signal reused for the autosave indicator (see below).
  - Owns all HTTP calls (`load`, `save`/autosave, `publish`) — the panel
    component is presentation-only and emits events.
  - Renders `<app-publish-panel>` conditionally (`@if (panelOpen())`),
    passing the current field values as inputs and listening for
    `(saveDraft)` and `(publish)` outputs.

- **`shared/components/publish-panel/publish-panel.component.ts`** (new)
  - Standalone component, `selector: 'app-publish-panel'`.
  - Inputs: `excerpt`, `excerptTe`, `seoTitle`, `seoDescription`, `category`,
    `sources: string[]`, `faq: {question, answer}[] | null`, `author`,
    `updatedAt`, `status: Article['status']`, `lang: 'en' | 'te'`,
    `saving: boolean`.
  - Two-way bindable fields (`excerpt`, `excerptTe`, `seoTitle`,
    `seoDescription`, `category`) via `[(field)]` model inputs (Angular
    `model()`), so the parent's plain properties stay the source of truth
    without duplicating state.
  - Outputs: `closed = output<void>()`, `saveDraft = output<void>()`,
    `publish = output<void>()`.
  - Renders as a fixed right-side drawer (`fixed inset-y-0 right-0`), full
    height, `w-full max-w-md`, backdrop behind it closes the panel on click.
  - Sources/FAQ/author/updated-at rendered read-only, same markup as today's
    "Details" section.

### Data flow — autosave

- Parent component tracks dirty state with a plain RxJS `Subject<void>`
  (`private readonly dirty$ = new Subject<void>()`), consistent with the
  codebase's template-driven-forms style (no reactive forms conversion).
- Every relevant `(ngModelChange)` (title, excerpt, body via
  `(valueChange)`, titleTe/excerptTe/bodyMdTe, seoTitle, seoDescription)
  calls `this.dirty$.next()`.
- Constructor subscribes: `this.dirty$.pipe(debounceTime(2000)).subscribe(() => this.autoSave())`.
  Subscription is torn down implicitly by `takeUntilDestroyed()`.
- `autoSave()` reuses the existing `save()` HTTP call but doesn't `alert`/block
  on errors the way a manual save might — sets `saveStatus` to `'error'` and
  shows the existing `actionError` banner.
- Status signal states: `'idle' | 'dirty' | 'saving' | 'saved' | 'error'`.
  `'dirty'` is set synchronously on any `dirty$.next()` so the indicator
  shows "Unsaved changes" immediately, before the debounce fires.
- The Publish panel's "Save draft" button calls the same `save()` path
  immediately (bypassing the debounce) — useful right before closing the
  panel or publishing.

### Error handling

- Load failure: unchanged — existing `loadError` banner, no editor shown.
- Autosave failure: `actionError` banner appears (existing pattern), status
  indicator shows "Error saving" in `--color-danger`; next successful
  edit + debounce retries automatically (no manual retry button needed —
  the user just keeps typing and it retries on the next debounce tick).
- Publish failure: unchanged — existing `actionError` banner inside the
  panel this time (panel stays open on failure so the user can retry).

## Out of scope

- Cover image and tags fields — the backend `Article` model doesn't have
  them; adding them is a separate backend + admin change.
- Changes to the dashboard's "write new" / "generate draft" forms — the
  reported pain point was the editor page, not the dashboard.
- Word count / estimated read time — not requested; can be added later as
  a small addition to the top bar if wanted.

## Testing

- Manual: open an existing draft, confirm the writing view shows only
  title + body + language toggle; type in the title and body and confirm
  the status indicator goes Unsaved → Saving… → Saved without clicking
  anything; open the Publish panel and confirm excerpt/SEO/category edits
  save via "Save draft"; publish from the panel and confirm it matches
  today's publish behavior (confirm dialog, "View live" link appears).
- Manual: verify dark mode styling of the panel and top bar.
