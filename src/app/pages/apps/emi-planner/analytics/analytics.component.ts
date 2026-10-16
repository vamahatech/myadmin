import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { DecimalPipe, LowerCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { AppEventsService } from '../../../../core/services/app-events.service';
import {
  AppEventCount,
  AppEventsPreviousSummary,
  AppEventsSummary,
  AppEventsTimeseries,
  EventBreakdown,
} from '../../../../models/app-events.model';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

const APP_SLUG = 'emi-planner';

type Tab = 'overview' | 'features' | 'funnels';
type RangeDays = 1 | 7 | 30 | 90;

/** A large enough swing to surface as a heads-up banner, not just a colored badge. */
const ANOMALY_THRESHOLD_PCT = 1;

/** % change vs. the previous period; null when there's no baseline to compare against
 *  (previous period had zero — showing "New" or "—" reads better than a divide-by-zero). */
function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Normalizes a series of values into an SVG polyline `points` string (viewBox 0 0 100 28). */
function sparklinePoints(values: number[]): string {
  if (values.length === 0) return '';
  const width = 100;
  const height = 28;
  const max = Math.max(...values, 1);
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  return values
    .map((v, i) => `${(i * stepX).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`)
    .join(' ');
}

interface FunnelStep {
  label: string;
  fromEvent: string;
  toEvent: string;
}

interface FunnelResult extends FunnelStep {
  fromCount: number;
  toCount: number;
  rate: number | null; // null when fromCount is 0 — nothing to convert from
  previousRate: number | null;
  /** Percentage-point change in conversion rate (not % change of the rate itself — pp reads better for ratios). */
  ratePointsDelta: number | null;
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
  imports: [EmptyStateComponent, SkeletonComponent, IconComponent, DecimalPipe, LowerCasePipe, FormsModule, PageHeaderComponent],
  templateUrl: './analytics.component.html',
})
export class AnalyticsComponent implements OnInit {
  private readonly appEvents = inject(AppEventsService);
  private readonly meta = inject(Meta);

  readonly tab = signal<Tab>('overview');
  readonly days = signal<RangeDays>(1);

  /** Set together, or not at all — a custom range overrides `days` entirely when present. */
  readonly customRange = signal<{ from: string; to: string } | null>(null);
  readonly showCustomPicker = signal(false);
  customFrom = '';
  customTo = '';
  readonly customRangeError = signal('');

  readonly summary = signal<AppEventsSummary | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal('');

  readonly timeseries = signal<AppEventsTimeseries | null>(null);

  /** Events per install — a rough "how much does an active user actually do" signal. */
  readonly eventsPerInstall = computed(() => {
    const s = this.summary();
    if (!s || s.uniqueInstalls === 0) return 0;
    return s.totalEvents / s.uniqueInstalls;
  });

  /** Falls back to zeros when talking to a backend that predates the `previous` field,
   *  so an unrolled-back deploy degrades to "no comparison" instead of a broken page. */
  private previousOrEmpty(s: AppEventsSummary): AppEventsPreviousSummary {
    return s.previous ?? { totalEvents: 0, uniqueInstalls: 0, byEvent: [] };
  }

  /** True when the previous period has zero events at all — not just this metric/event/funnel.
   *  In that case every "New" badge would fire at once (every row has no baseline), which reads
   *  as noise rather than a signal, so callers should show one explanatory note instead. */
  readonly noPreviousData = computed(() => {
    const s = this.summary();
    return !!s && this.previousOrEmpty(s).totalEvents === 0;
  });

  readonly previousEventsPerInstall = computed(() => {
    const s = this.summary();
    if (!s) return 0;
    const previous = this.previousOrEmpty(s);
    if (previous.uniqueInstalls === 0) return 0;
    return previous.totalEvents / previous.uniqueInstalls;
  });

  readonly totalEventsDelta = computed(() => {
    const s = this.summary();
    return s ? pctDelta(s.totalEvents, this.previousOrEmpty(s).totalEvents) : null;
  });

  readonly uniqueInstallsDelta = computed(() => {
    const s = this.summary();
    return s ? pctDelta(s.uniqueInstalls, this.previousOrEmpty(s).uniqueInstalls) : null;
  });

  readonly eventsPerInstallDelta = computed(() =>
    pctDelta(this.eventsPerInstall(), this.previousEventsPerInstall()),
  );

  /** days=1 compares calendar days (today/yesterday); everything else is a rolling window;
   *  a custom range compares the picked dates against the equal-length period right before it. */
  readonly currentPeriodLabel = computed(() => {
    const range = this.customRange();
    if (range) return `${range.from} → ${range.to}`;
    return this.days() === 1 ? 'Today' : `Last ${this.days()}d`;
  });
  readonly previousPeriodLabel = computed(() =>
    this.customRange() ? 'Previous period' : this.days() === 1 ? 'Yesterday' : `Previous ${this.days()}d`,
  );
  readonly rangeDescription = computed(() => {
    if (this.customRange()) return 'in the selected range';
    return this.days() === 1 ? 'today' : `in the last ${this.days()} days`;
  });

  /** Daily-bucketed series from the timeseries endpoint, one array per stat — feeds the sparklines. */
  readonly sparklineSeries = computed(() => {
    const t = this.timeseries();
    if (!t || t.points.length === 0) return { events: [], installs: [], perInstall: [] };
    return {
      events: t.points.map((p) => p.totalEvents),
      installs: t.points.map((p) => p.uniqueInstalls),
      perInstall: t.points.map((p) => (p.uniqueInstalls > 0 ? p.totalEvents / p.uniqueInstalls : 0)),
    };
  });

  /** The 3 Overview stat cards, each carrying its own current/previous pair, delta, and sparkline —
   *  driven from one array so the template renders one card layout instead of three copies. */
  readonly overviewStats = computed(() => {
    const s = this.summary();
    if (!s) return [];
    const previous = this.previousOrEmpty(s);
    const series = this.sparklineSeries();
    return [
      {
        key: 'events',
        label: 'Total in-app events',
        current: s.totalEvents,
        previous: previous.totalEvents,
        delta: this.totalEventsDelta(),
        format: '1.0-0',
        spark: sparklinePoints(series.events),
      },
      {
        key: 'installs',
        label: 'Unique installs active',
        current: s.uniqueInstalls,
        previous: previous.uniqueInstalls,
        delta: this.uniqueInstallsDelta(),
        format: '1.0-0',
        spark: sparklinePoints(series.installs),
      },
      {
        key: 'perInstall',
        label: 'Events per active install',
        current: this.eventsPerInstall(),
        previous: this.previousEventsPerInstall(),
        delta: this.eventsPerInstallDelta(),
        format: '1.1-1',
        spark: sparklinePoints(series.perInstall),
      },
    ];
  });

  /** Swings big enough to flag as a heads-up banner rather than just a colored badge. */
  readonly anomalies = computed(() =>
    this.overviewStats().filter((s) => s.delta !== null && Math.abs(s.delta) >= ANOMALY_THRESHOLD_PCT),
  );

  /** byEvent, already sorted by the backend — attach a relative bar width plus the delta
   *  vs. the same event's count in the previous period, so feature adoption trends show up here too. */
  readonly featureBars = computed(() => {
    const s = this.summary();
    if (!s || s.byEvent.length === 0) return [];
    const max = s.byEvent[0].count;
    const previousByEvent = new Map(this.previousOrEmpty(s).byEvent.map((e) => [e.event, e.count]));
    return s.byEvent.map((e) => {
      const previousCount = previousByEvent.get(e.event) ?? 0;
      return {
        ...e,
        widthPct: max > 0 ? Math.round((e.count / max) * 100) : 0,
        previousCount,
        delta: pctDelta(e.count, previousCount),
      };
    });
  });

  /** Which event's prop breakdown is expanded in the Feature usage tab, if any. */
  readonly expandedEvent = signal<string | null>(null);
  readonly breakdownLoading = signal(false);
  readonly breakdownError = signal('');
  private readonly breakdownCache = new Map<string, EventBreakdown>();
  readonly breakdown = signal<EventBreakdown | null>(null);

  readonly funnels = computed<FunnelResult[]>(() => {
    const s = this.summary();
    if (!s) return [];
    const countOf = (byEvent: AppEventCount[], event: string) =>
      byEvent.find((e) => e.event === event)?.count ?? 0;
    const previousByEvent = this.previousOrEmpty(s).byEvent;

    return FUNNELS.map((f) => {
      const fromCount = countOf(s.byEvent, f.fromEvent);
      const toCount = countOf(s.byEvent, f.toEvent);
      const rate = fromCount > 0 ? toCount / fromCount : null;

      const previousFromCount = countOf(previousByEvent, f.fromEvent);
      const previousToCount = countOf(previousByEvent, f.toEvent);
      const previousRate = previousFromCount > 0 ? previousToCount / previousFromCount : null;

      return {
        ...f,
        fromCount,
        toCount,
        rate,
        previousRate,
        ratePointsDelta: rate !== null && previousRate !== null ? (rate - previousRate) * 100 : null,
      };
    });
  });

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    this.load();
  }

  /** Angular templates can't call global `Object.keys` directly. */
  readonly objectKeys = Object.keys;

  setTab(tab: Tab): void {
    this.tab.set(tab);
  }

  setDays(days: RangeDays): void {
    if (this.days() === days && !this.customRange()) return;
    this.days.set(days);
    this.customRange.set(null);
    this.showCustomPicker.set(false);
    this.breakdownCache.clear();
    this.expandedEvent.set(null);
    this.breakdown.set(null);
    this.load();
  }

  toggleCustomPicker(): void {
    this.showCustomPicker.set(!this.showCustomPicker());
  }

  applyCustomRange(): void {
    if (!this.customFrom || !this.customTo) {
      this.customRangeError.set('Pick both a start and end date.');
      return;
    }
    if (this.customFrom > this.customTo) {
      this.customRangeError.set('Start date must be before the end date.');
      return;
    }
    this.customRangeError.set('');
    this.customRange.set({ from: this.customFrom, to: this.customTo });
    this.showCustomPicker.set(false);
    this.breakdownCache.clear();
    this.expandedEvent.set(null);
    this.breakdown.set(null);
    this.load();
  }

  toggleEventBreakdown(event: string): void {
    if (this.expandedEvent() === event) {
      this.expandedEvent.set(null);
      return;
    }
    this.expandedEvent.set(event);
    this.breakdownError.set('');

    const cacheKey = `${event}:${this.days()}`;
    const cached = this.breakdownCache.get(cacheKey);
    if (cached) {
      this.breakdown.set(cached);
      return;
    }

    this.breakdown.set(null);
    this.breakdownLoading.set(true);
    this.appEvents.eventBreakdown(APP_SLUG, event, this.days()).subscribe({
      next: (b) => {
        this.breakdownCache.set(cacheKey, b);
        this.breakdown.set(b);
        this.breakdownLoading.set(false);
      },
      error: () => {
        this.breakdownError.set('Could not load breakdown for this event.');
        this.breakdownLoading.set(false);
      },
    });
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    const range = this.customRange();
    this.appEvents.summary(APP_SLUG, this.days(), range?.from, range?.to).subscribe({
      next: (s) => {
        this.summary.set(s);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load analytics.');
        this.loading.set(false);
      },
    });
    this.loadTimeseries();
  }

  private loadTimeseries(): void {
    const range = this.customRange();
    this.appEvents.timeseries(APP_SLUG, this.days(), range?.from, range?.to).subscribe({
      // Sparklines are a nice-to-have — a failed fetch just means no sparkline, not a page error.
      next: (t) => this.timeseries.set(t),
      error: () => this.timeseries.set(null),
    });
  }
}
