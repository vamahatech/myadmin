import { Component, input } from '@angular/core';

/**
 * Standard page heading: title + optional description on the left, page
 * actions (projected) on the right; wraps under the title on narrow screens.
 * Uses the platform .page-head styles, the same ones Verdiq's pages use.
 *
 *   <app-page-header title="Articles" description="…">
 *     <button class="btn btn-secondary">Refresh</button>
 *   </app-page-header>
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <div class="page-head">
      <div class="min-w-0">
        <h1>{{ title() }}</h1>
        @if (description()) {
          <p class="muted">{{ description() }}</p>
        }
      </div>
      <div class="page-head__actions">
        <ng-content />
      </div>
    </div>
  `,
  host: { class: 'block' },
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input<string>();
}
