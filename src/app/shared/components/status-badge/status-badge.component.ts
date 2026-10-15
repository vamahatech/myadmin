import { Component, computed, input } from '@angular/core';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

/** Known statuses → tone + human label, so the same state looks the same in
 *  every app. Unknown values fall back to a neutral badge with the raw text. */
const STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  DRAFT: { tone: 'neutral', label: 'Draft' },
  IN_REVIEW: { tone: 'warning', label: 'In review' },
  PUBLISHED: { tone: 'success', label: 'Published' },
  PENDING: { tone: 'warning', label: 'Pending' },
  ACTIVE: { tone: 'success', label: 'Active' },
  INACTIVE: { tone: 'neutral', label: 'Inactive' },
  FAILED: { tone: 'danger', label: 'Failed' },
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `<span [class]="'badge badge-' + resolved().tone">{{ resolved().label }}</span>`,
  host: { class: 'inline-flex shrink-0' },
})
export class StatusBadgeComponent {
  /** A known status key (e.g. 'PUBLISHED') or any label. */
  readonly status = input.required<string>();
  /** Override the tone for labels that aren't in the status map. */
  readonly tone = input<BadgeTone>();

  readonly resolved = computed(() => {
    const known = STATUS[this.status()];
    return {
      tone: this.tone() ?? known?.tone ?? 'neutral',
      label: known?.label ?? this.status(),
    };
  });
}
