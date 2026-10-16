import { Component, input } from '@angular/core';
import { IconComponent, IconName } from '../icon/icon.component';

/**
 * Empty / zero-result state for lists and panels. Put it inside a .card (or
 * as the body of one); project an optional action button.
 *
 *   <app-empty-state icon="inbox" title="No submissions" body="New ones appear here.">
 *     <button class="btn btn-secondary btn-sm">Refresh</button>
 *   </app-empty-state>
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="flex flex-col items-center text-center px-6 py-12">
      <span class="w-11 h-11 rounded-full bg-surface text-text2 flex items-center justify-center mb-3">
        <app-icon [name]="icon()" [size]="20" />
      </span>
      <p class="text-sm font-semibold text-text">{{ title() }}</p>
      @if (body()) {
        <p class="mt-1 text-sm text-text2 max-w-sm">{{ body() }}</p>
      }
      <div class="mt-4 flex flex-wrap justify-center gap-2 empty:hidden"><ng-content /></div>
    </div>
  `,
  host: { class: 'block' },
})
export class EmptyStateComponent {
  readonly icon = input<IconName>('inbox');
  readonly title = input.required<string>();
  readonly body = input<string>();
}
