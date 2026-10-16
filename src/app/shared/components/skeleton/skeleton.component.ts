import { Component, computed, input } from '@angular/core';

/**
 * Loading placeholder shaped like the content it stands in for.
 *   variant="rows"  — list/table rows inside a .card (default)
 *   variant="stats" — a row of .stat tiles
 *   variant="cards" — stacked content cards (feeds, review queues)
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `
    <span class="sr-only" role="status">Loading…</span>
    @switch (variant()) {
      @case ('stats') {
        <div class="stat-grid" aria-hidden="true">
          @for (i of items(); track i) {
            <div class="stat">
              <div class="skeleton h-3 w-24"></div>
              <div class="skeleton h-6 w-16 mt-3"></div>
            </div>
          }
        </div>
      }
      @case ('cards') {
        <div class="flex flex-col gap-3" aria-hidden="true">
          @for (i of items(); track i) {
            <div class="card p-5">
              <div class="skeleton h-4 w-1/3"></div>
              <div class="skeleton h-3 w-2/3 mt-3"></div>
              <div class="skeleton h-3 w-1/2 mt-2"></div>
            </div>
          }
        </div>
      }
      @default {
        <div class="card overflow-hidden" aria-hidden="true">
          @for (i of items(); track i) {
            <div class="flex items-center gap-4 px-5 py-4 border-b border-border last:border-b-0">
              <div class="flex-1 min-w-0">
                <div class="skeleton h-4" [style.width.%]="60 - (i % 3) * 12"></div>
                <div class="skeleton h-3 w-32 mt-2"></div>
              </div>
              <div class="skeleton h-5 w-16 rounded-full"></div>
            </div>
          }
        </div>
      }
    }
  `,
  host: { class: 'block' },
})
export class SkeletonComponent {
  readonly variant = input<'rows' | 'stats' | 'cards'>('rows');
  readonly count = input(5);
  readonly items = computed(() => Array.from({ length: this.count() }, (_, i) => i));
}
