import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { AppEventsService } from '../../../../core/services/app-events.service';
import { PushAdminService } from '../../../../core/services/push-admin.service';
import { FeedbackService } from '../../../../core/services/feedback.service';
import { AppEventsSummary, EventBreakdown } from '../../../../models/app-events.model';
import {
  BroadcastResult,
  CredentialStatus,
  PushCronRunRow,
  PushTokenRow,
} from '../../../../models/push-admin.model';
import { FeedbackRow, FeedbackStatus } from '../../../../models/feedback.model';

const APP_SLUG = 'emi-planner';

type Tab = 'overview' | 'features' | 'funnels' | 'push' | 'feedback';
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
  imports: [DecimalPipe, DatePipe, FormsModule],
  templateUrl: './analytics.component.html',
})
export class AnalyticsComponent implements OnInit {
  private readonly appEvents = inject(AppEventsService);
  private readonly push = inject(PushAdminService);
  private readonly feedback = inject(FeedbackService);
  private readonly meta = inject(Meta);

  readonly tab = signal<Tab>('overview');
  readonly days = signal<RangeDays>(30);

  // ── Usage (app-events) ──────────────────────────────────────────
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

  /** Which event's prop breakdown is expanded in the Feature usage tab, if any. */
  readonly expandedEvent = signal<string | null>(null);
  readonly breakdownLoading = signal(false);
  readonly breakdownError = signal('');
  private readonly breakdownCache = new Map<string, EventBreakdown>();
  readonly breakdown = signal<EventBreakdown | null>(null);

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

  // ── Push & retention ─────────────────────────────────────────────
  readonly credential = signal<CredentialStatus | null>(null);
  readonly tokens = signal<PushTokenRow[]>([]);
  readonly cronRuns = signal<PushCronRunRow[]>([]);
  readonly pushLoadError = signal('');

  broadcastTitle = '';
  broadcastBody = '';
  readonly broadcastStatus = signal<'idle' | 'sending' | 'error'>('idle');
  readonly broadcastResult = signal<BroadcastResult | null>(null);
  readonly broadcastError = signal('');
  readonly lastActionLabel = signal<'broadcast' | 'cron' | null>(null);
  readonly cronRunning = signal(false);

  // ── Feedback ─────────────────────────────────────────────────────
  readonly feedbackItems = signal<FeedbackRow[]>([]);
  readonly feedbackTotal = signal(0);
  readonly feedbackLoading = signal(false);
  readonly feedbackLoadError = signal('');
  readonly feedbackStatusFilter = signal<FeedbackStatus | ''>('');

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    this.load();
  }

  /** Angular templates can't call global `Object.keys` directly. */
  readonly objectKeys = Object.keys;

  setTab(tab: Tab): void {
    this.tab.set(tab);
    if (tab === 'push' && this.credential() === null) {
      this.loadPush();
    }
    if (tab === 'feedback' && this.feedbackItems().length === 0) {
      this.loadFeedback();
    }
  }

  setDays(days: RangeDays): void {
    if (this.days() === days) return;
    this.days.set(days);
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
    this.appEvents.summary(APP_SLUG, this.days()).subscribe({
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

  // ── Push & retention ─────────────────────────────────────────────

  private refreshTokens(): void {
    this.push.listTokens(APP_SLUG).subscribe({
      next: (rows) => this.tokens.set(rows),
      error: () => this.pushLoadError.set('Could not refresh registered devices.'),
    });
  }

  loadPush(): void {
    this.pushLoadError.set('');
    this.push.getCredentialStatus().subscribe({
      next: (status) => this.credential.set(status),
      error: () => this.pushLoadError.set('Could not load credential status.'),
    });
    this.refreshTokens();
    this.push.getCronRuns(APP_SLUG).subscribe({
      next: (rows) => this.cronRuns.set(rows),
      error: () => this.pushLoadError.set('Could not load cron run history.'),
    });
  }

  sendBroadcast(): void {
    if (this.broadcastStatus() === 'sending') return;
    const title = this.broadcastTitle.trim();
    const body = this.broadcastBody.trim();
    if (!title || !body) {
      this.broadcastStatus.set('error');
      this.broadcastError.set('Title and body are both required.');
      return;
    }
    if (this.tokens().length === 0) {
      this.broadcastStatus.set('error');
      this.broadcastError.set('No devices registered for this app yet.');
      return;
    }
    if (!confirm(`Send this notification to all ${this.tokens().length} registered device(s)?`)) {
      return;
    }
    this.broadcastStatus.set('sending');
    this.broadcastError.set('');
    this.broadcastResult.set(null);
    this.lastActionLabel.set(null);
    this.push.broadcast(APP_SLUG, { title, body }).subscribe({
      next: (result) => {
        this.broadcastResult.set(result);
        this.lastActionLabel.set('broadcast');
        this.broadcastStatus.set('idle');
        this.broadcastTitle = '';
        this.broadcastBody = '';
        this.refreshTokens();
      },
      error: () => {
        this.broadcastStatus.set('error');
        this.broadcastError.set('Broadcast failed. Please try again.');
      },
    });
  }

  runCronNow(): void {
    if (this.cronRunning()) return;
    this.cronRunning.set(true);
    this.broadcastResult.set(null);
    this.lastActionLabel.set(null);
    this.push.runCronNow(APP_SLUG).subscribe({
      next: (result) => {
        this.cronRunning.set(false);
        this.push.getCronRuns(APP_SLUG).subscribe({
          next: (rows) => this.cronRuns.set(rows),
          error: () => this.pushLoadError.set('Could not load cron run history.'),
        });
        this.broadcastResult.set(result);
        this.lastActionLabel.set('cron');
        this.refreshTokens();
      },
      error: () => {
        this.cronRunning.set(false);
        this.pushLoadError.set('Running the dormancy check failed.');
      },
    });
  }

  // ── Feedback ─────────────────────────────────────────────────────

  loadFeedback(): void {
    this.feedbackLoading.set(true);
    this.feedbackLoadError.set('');
    const status = this.feedbackStatusFilter();
    this.feedback
      .findAll({ app: APP_SLUG, status: status || undefined, limit: 50 })
      .subscribe({
        next: (page) => {
          this.feedbackItems.set(page.items);
          this.feedbackTotal.set(page.meta.total);
          this.feedbackLoading.set(false);
        },
        error: () => {
          this.feedbackLoadError.set('Could not load feedback.');
          this.feedbackLoading.set(false);
        },
      });
  }

  setFeedbackStatusFilter(status: FeedbackStatus | ''): void {
    this.feedbackStatusFilter.set(status);
    this.loadFeedback();
  }

  markFeedback(id: string, status: FeedbackStatus): void {
    this.feedback.updateStatus(id, status).subscribe({
      next: () => this.loadFeedback(),
      error: () => this.feedbackLoadError.set('Could not update feedback status.'),
    });
  }
}
