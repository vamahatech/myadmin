import { Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppTile } from '../../../core/models/app-registry.model';

export type AppRowDensity = 'comfortable' | 'compact';
export type AppRowAction = 'arrow' | 'external-link';

/**
 * One numbered entry in the studio directory. The whole row is a single
 * link; destination, logo and copy all come from the AppTile record, so the
 * row itself never hardcodes where an app lives.
 */
@Component({
  selector: 'app-row',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './app-row.component.html',
  host: { class: 'block' },
})
export class AppRowComponent {
  readonly app = input.required<AppTile>();
  /** Zero-based position in the list; rendered as 01, 02, … */
  readonly index = input.required<number>();
  readonly density = input<AppRowDensity>('comfortable');
  readonly showDescription = input(true);
  readonly action = input<AppRowAction>('arrow');
  /** Only for apps that are genuinely unavailable — never set speculatively. */
  readonly disabled = input(false);
  /** Shown under the description when disabled, so state isn't color-only. */
  readonly disabledReason = input('Currently unavailable');

  readonly number = computed(() => String(this.index() + 1).padStart(2, '0'));

  readonly rowClass = computed(() => {
    const pad = this.density() === 'compact' ? 'py-3 min-h-[68px]' : 'py-5 min-h-[92px]';
    return `${pad} group flex items-center gap-3 sm:gap-4 px-4 sm:px-6 w-full transition-colors duration-150 motion-reduce:transition-none`;
  });
}
