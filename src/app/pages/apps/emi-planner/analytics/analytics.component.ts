import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Meta } from '@angular/platform-browser';
import { AppEventsService } from '../../../../core/services/app-events.service';
import { AppEventsSummary } from '../../../../models/app-events.model';

type Tab = 'overview' | 'features' | 'funnels';
type RangeDays = 7 | 30 | 90;

interface FunnelStep {
  label: string;
  fromEvent: string;
  toEvent: string;
}

interface FunnelResult extends FunnelStep {
  fromCount: number;
  toCount: number;
  rate: number | null; // null when fromCount is 0 — nothing to convert from
}

/** Feature-adoption funnels worth watching, defined against EMI Planner's real
 *  event vocabulary (see vamaha-backend's app-events/constants/event-schemas.ts).
 *  Purely a view over byEvent counts already returned by the summary endpoint —
 *  no new data, just the ratios that matter. */
const FUNNELS: FunnelStep[] = [
  { label: 'Onboarding completion', fromEvent: 'onboarding_view', toEvent: 'onboarding_complete' },
  { label: 'Paywall conversion', fromEvent: 'paywall_view', toEvent: 'purchase_success' },
  { label: 'Loan tracker adoption', fromEvent: 'app_open', toEvent: 'tracker_open' },
  { label: 'PDF export adoption', fromEvent: 'app_open', toEvent: 'pdf_export' },
];

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './analytics.component.html',
})
export class AnalyticsComponent implements OnInit {
  private readonly appEvents = inject(AppEventsService);
  private readonly meta = inject(Meta);

  readonly tab = signal<Tab>('overview');
  readonly days = signal<RangeDays>(30);

  readonly summary = signal<AppEventsSummary | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal('');

  /** Events per install — a rough "how much does an active user actually do" signal. */
  readonly eventsPerInstall = computed(() => {
    const s = this.summary();
    if (!s || s.uniqueInstalls === 0) return 0;
    return s.totalEvents / s.uniqueInstalls;
  });

  /** byEvent, already sorted by the backend — just attach a relative bar width. */
  readonly featureBars = computed(() => {
    const s = this.summary();
    if (!s || s.byEvent.length === 0) return [];
    const max = s.byEvent[0].count;
    return s.byEvent.map((e) => ({
      ...e,
      widthPct: max > 0 ? Math.round((e.count / max) * 100) : 0,
    }));
  });

  readonly funnels = computed<FunnelResult[]>(() => {
    const s = this.summary();
    if (!s) return [];
    const countOf = (event: string) =>
      s.byEvent.find((e) => e.event === event)?.count ?? 0;

    return FUNNELS.map((f) => {
      const fromCount = countOf(f.fromEvent);
      const toCount = countOf(f.toEvent);
      return {
        ...f,
        fromCount,
        toCount,
        rate: fromCount > 0 ? toCount / fromCount : null,
      };
    });
  });

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    this.load();
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);
  }

  setDays(days: RangeDays): void {
    if (this.days() === days) return;
    this.days.set(days);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.appEvents.summary('emi-planner', this.days()).subscribe({
      next: (s) => {
        this.summary.set(s);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load analytics.');
        this.loading.set(false);
      },
    });
  }
}
