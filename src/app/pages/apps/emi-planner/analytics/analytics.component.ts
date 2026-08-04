import { Component, inject, signal, OnInit } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { AnalyticsService } from '../../../../core/services/analytics.service';
import { AnalyticsSummary } from '../../../../models/analytics.model';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [],
  templateUrl: './analytics.component.html',
})
export class AnalyticsComponent implements OnInit {
  private readonly analytics = inject(AnalyticsService);
  private readonly meta = inject(Meta);

  readonly summary = signal<AnalyticsSummary | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly emiPlannerEvents = signal(0);

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.analytics.summary(30).subscribe({
      next: (s) => {
        this.summary.set(s);
        this.emiPlannerEvents.set(
          s.byApp.find((a) => a.appSlug === 'emi-planner')?.count ?? 0,
        );
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load analytics.');
        this.loading.set(false);
      },
    });
  }
}
