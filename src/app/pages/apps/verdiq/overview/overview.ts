import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { DashboardMetrics } from '../../../../core/models/verdiq/dashboard.model';

// The landing page: a live data-health snapshot. Answers "what test data do we
// actually have?" — headline counts, catalog completeness (the null-nutrition
// alarm), verdict mix, and the category breakdown.
@Component({
  selector: 'app-overview',
  imports: [DecimalPipe],
  templateUrl: './overview.html',
  styleUrl: './overview.sass',
})
export class Overview {
  private api = inject(AdminApi);

  readonly metrics = signal<DashboardMetrics | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // Largest category count, to scale the bars.
  readonly maxCategory = computed(() => {
    const cats = this.metrics()?.categories ?? [];
    return cats.reduce((m, c) => Math.max(m, c.count), 0) || 1;
  });

  // Verdict mix total, to guard the empty case.
  readonly verdictTotal = computed(() => {
    const v = this.metrics()?.verdicts;
    return v ? v.OK + v.Caution + v.Avoid : 0;
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getMetrics().subscribe({
      next: (m) => {
        this.metrics.set(m);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load metrics. Is the backend running?');
        this.loading.set(false);
      },
    });
  }

  barWidth(count: number): string {
    return `${Math.round((count / this.maxCategory()) * 100)}%`;
  }
}
