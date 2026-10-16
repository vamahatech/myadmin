# Design System Pass (audit → 4 phases)

Follows `2026-10-16-unified-shell-design.md`. That pass gave the console one
frame; this one makes the pages inside it consistent and adds the missing
SaaS basics.

## Audit findings that drove it

1. Global `.seg` (from the shell pass) collided with Verdiq's verdict bar
   `.seg.ok/.caution/.avoid`. Renamed to `.segmented`.
2. Dark mode existed in tokens but nothing ever set `html.dark`.
3. Three filter-tab styles (primary-filled EMI tabs with raw `text-white`,
   Verdiq `.tab`, Articles `.seg`).
4. Ten `window.confirm()` calls despite a styled modal existing.
5. Emoji/glyph icons (✍️ ✨ 📊 💬 ★ 📚 ✎ 📝 🎉 ⚠ ▲▼▸ ✓ ✕).
6. Hand-rolled `.page-head` on 16 pages; breadcrumb only on Articles.
7. Three KPI tile styles / number sizes.
8. Mixed card radii and section-label styles.
9. Filter controls loose on the page, not attached to their list.
10. Text-only "Loading…", full-screen overlay on every request, ad-hoc empty
    states, inline success text.
11. Push forms without labels/counters.
12. Login off-system (ink seal, custom inputs, illustrations).
13. Verdiq's 13 modules in one flat list; no sidebar footer/collapse.
14. Primary green used for data; `--color-blue` had no dark value and no
    Tailwind name.
15. Static home list.

Also found: Verdiq product links pointed at `/products…` (legacy standalone
paths) and fell through `**` to home — now `/apps/verdiq/products…`.

## What shipped

**Phase 1 — unify.** `.segmented` everywhere (`aria-pressed`). `ConfirmService`
+ root `<app-confirm-dialog>`; `modal` / `confirm-delete-modal` moved to
`shared/components/` and switched to platform tokens with focus management.
Emoji → `app-icon` (new names incl. `filled` stars). All pages use
`app-page-header`; `ShellContext` (provided by `AppShellComponent`) gives an
automatic breadcrumb. `ThemeService` (light/dark/system, pre-boot script)
with a switch in the account menu and Settings.

**Phase 2 — patterns.** `.stat` (+ deltas, `.stat-grid`, `.is-alert`) replaces
Verdiq `.kpi` and EMI analytics cards. `.card-toolbar` + `.search-field` +
`.th-sort`; `app-pagination`, `app-empty-state`, `app-skeleton`. Global
overlay only on first load, then a 2px top progress bar. `ToastService` +
`<app-toaster>`; Verdiq `notice` cards became toasts. RenewLoop Users:
debounced search, segmented filter, sortable headers. Verdiq Products and EMI
Feedback restructured.

**Phase 3 — screens.** Login: split layout (brand panel listing the apps +
form), standard inputs, icon password toggle. Push: `app-push-composer`
(labels, counters, lock-screen preview) and `app-push-console` (status,
stats, composer, devices + cron tables) shared by Vamaha and EMI Planner;
RenewLoop uses the composer with an Everyone / Specific users switch. Sidebar
groups (`AppNavItem.group`), footer, 64px icon-rail collapse. Home rows show
backend status + one metric per app. Chart tokens `chart-1..3` (light
`#2A70B0 #C47A1E #B04A7A`, dark `#4A8FD0 #BD7B22 #C9608F`) validated with
the dataviz skill's `validate_palette.js` against the card surfaces, all-pairs,
both modes; dark `--color-blue: #6FA8DC`; Tailwind `blue` + `chart-*`.

**Phase 4 — command palette.** Ctrl/⌘+K (or the header search field): apps,
every route's `navItems`, and actions (new article, settings, theme). Combobox
+ listbox, ↑/↓/Enter/Esc, ranked matching.

## Testing

- `ng build` after each phase — only the 2 known NG8107 warnings.
- Grep gates: no `confirm(`, emoji, `text-white` or raw palette, or stray
  `class="page-head"` in `src/app` templates (code comments excepted).
- Playwright (standalone `playwright-core` + local chromium, mocked auth,
  articles and push endpoints) at 1440 / 1024 / 390, light + dark: Articles
  (+ empty/loading), push console (+ confirm dialog), EMI analytics/feedback,
  Verdiq overview/products/reports (grouped + rail sidebar), RenewLoop
  users/notifications, Home, Login, Settings. Keyboard: confirm dialog focuses
  Cancel and returns focus to the trigger on Esc; palette "feed" + Enter
  navigates to EMI Feedback.

## Follow-ups

- Verdiq review queues and forms still use Verdiq-local card/form styles.
- `PushAdminService.listApps()` only returns `emi-planner`.
- Data-heavy pages verified only with mocks/empty states; re-check with live data.
