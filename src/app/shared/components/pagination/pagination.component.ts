import { Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

/**
 * Footer for a paged list card: "Showing 21–40 of 134" + numbered pages.
 *   <app-pagination [page]="p.page" [pageSize]="p.limit" [total]="p.total" (pageChange)="goToPage($event)" />
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [IconComponent, DecimalPipe],
  template: `
    <nav class="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-border text-sm" aria-label="Pagination">
      <p class="text-text2 tabular-nums">
        @if (total() > 0) {
          Showing {{ from() | number }}–{{ to() | number }} of {{ total() | number }}
        } @else {
          0 results
        }
      </p>
      <div class="flex items-center gap-1.5">
        <button type="button" class="pager-btn" aria-label="First page" [disabled]="page() <= 1" (click)="go(1)">
          <app-icon name="chevrons-left" [size]="16" />
        </button>
        <button type="button" class="pager-btn" aria-label="Previous page" [disabled]="page() <= 1" (click)="go(page() - 1)">
          <app-icon name="chevron-left" [size]="16" />
        </button>
        @for (n of numbers(); track $index) {
          @if (n === null) {
            <span class="w-6 text-center text-text2" aria-hidden="true">…</span>
          } @else {
            <button type="button" class="pager-btn" [class.is-current]="n === page()"
              [attr.aria-current]="n === page() ? 'page' : null" [attr.aria-label]="'Page ' + n" (click)="go(n)">{{ n }}</button>
          }
        }
        <button type="button" class="pager-btn" aria-label="Next page" [disabled]="page() >= pages()" (click)="go(page() + 1)">
          <app-icon name="chevron-right" [size]="16" />
        </button>
        <button type="button" class="pager-btn" aria-label="Last page" [disabled]="page() >= pages()" (click)="go(pages())">
          <app-icon name="chevrons-right" [size]="16" />
        </button>
      </div>
    </nav>
  `,
  styles: `
    .pager-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
      height: 32px;
      padding: 0 8px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-card);
      font-size: 13px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--color-text2);
      transition: background-color 150ms, color 150ms, border-color 150ms;
    }
    .pager-btn:hover:not(:disabled):not(.is-current) { background: var(--color-hover); color: var(--color-text); }
    .pager-btn:disabled { background: var(--color-surface); opacity: 0.6; cursor: not-allowed; }
    .pager-btn.is-current { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
    .pager-btn:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
  `,
  host: { class: 'block' },
})
export class PaginationComponent {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();
  readonly pageChange = output<number>();

  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  readonly from = computed(() => (this.page() - 1) * this.pageSize() + 1);
  readonly to = computed(() => Math.min(this.total(), this.page() * this.pageSize()));

  /** First, last, and current ±1, with null marking a gap: 1 … 4 5 6 … 12. */
  readonly numbers = computed<(number | null)[]>(() => {
    const last = this.pages();
    const cur = this.page();
    const keep = new Set([1, last, cur - 1, cur, cur + 1]);
    // Fill a gap of exactly one page instead of showing "…" for it.
    if (cur - 3 === 1) keep.add(2);
    if (cur + 3 === last) keep.add(last - 1);
    const out: (number | null)[] = [];
    let prev = 0;
    for (let n = 1; n <= last; n++) {
      if (!keep.has(n)) continue;
      if (n - prev > 1) out.push(null);
      out.push(n);
      prev = n;
    }
    return out;
  });

  go(n: number): void {
    if (n >= 1 && n <= this.pages() && n !== this.page()) this.pageChange.emit(n);
  }
}
