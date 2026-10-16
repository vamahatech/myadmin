import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { Analytics as AnalyticsData } from '../../../../core/models/verdiq/analytics.model';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

// Scan analytics — activity from scan_events: scans/day, cache hit-rate, verdict
// mix, most-scanned, and the unfound "add next" list. Real data once the app
// starts scanning; empty-but-honest until then.
@Component({
  selector: 'app-analytics',
  imports: [EmptyStateComponent, SkeletonComponent, PageHeaderComponent, DecimalPipe],
  templateUrl: './analytics.html',
  styleUrl: './analytics.sass',
})
export class Analytics {
  private api = inject(AdminApi);

  days = 30;
  readonly data = signal<AnalyticsData | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // Max scans in a day, to scale the trend bars.
  readonly maxDay = computed(() => {
    const p = this.data()?.perDay ?? [];
    return p.reduce((m, d) => Math.max(m, d.scans), 0) || 1;
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getAnalytics(this.days).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load analytics.');
        this.loading.set(false);
      },
    });
  }

  setDays(d: number): void {
    this.days = d;
    this.load();
  }

  barHeight(scans: number): string {
    return `${Math.max(4, Math.round((scans / this.maxDay()) * 100))}%`;
  }
}
