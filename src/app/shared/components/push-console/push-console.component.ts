import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PushAdminService } from '../../../core/services/push-admin.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { findApp } from '../../../core/models/app-registry.model';
import { CredentialStatus, PushCronRunRow, PushTokenRow } from '../../../models/push-admin.model';
import { PageHeaderComponent } from '../page-header/page-header.component';
import { PushComposerComponent } from '../push-composer/push-composer.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';
import { IconComponent } from '../icon/icon.component';

/**
 * Retention-push dashboard shared by every app that ships push (vamaha-backend
 * /apps/:slug/push/*): Firebase status, stats, composer + preview, devices
 * and dormancy-cron history. Pages are thin wrappers that pass the app slugs.
 */
@Component({
  selector: 'app-push-console',
  standalone: true,
  imports: [
    DatePipe, FormsModule, PageHeaderComponent, PushComposerComponent, EmptyStateComponent,
    SkeletonComponent, IconComponent,
  ],
  template: `
    <div class="page">
      <app-page-header [title]="title()" [description]="description()">
        @if (apps().length > 1) {
          <label class="sr-only" for="push-app">App</label>
          <select id="push-app" class="input w-auto" [ngModel]="slug()" (ngModelChange)="selectApp($event)">
            @for (a of apps(); track a) {
              <option [value]="a">{{ nameFor(a) }}</option>
            }
          </select>
        }
        @if (credential(); as c) {
          <span class="badge" [class.badge-success]="c.configured" [class.badge-danger]="!c.configured">
            <span class="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true"></span>
            {{ c.configured ? 'Firebase connected' : 'Firebase not configured' }}
          </span>
        } @else {
          <span class="badge badge-neutral">Checking Firebase…</span>
        }
      </app-page-header>

      @if (loadError()) {
        <div class="card state error" role="alert">{{ loadError() }}</div>
      }

      @if (loading()) {
        <app-skeleton variant="stats" [count]="3" />
      } @else {
        <div class="stat-grid">
          <div class="stat">
            <p class="stat__label">Registered devices</p>
            <p class="stat__value">{{ tokens().length }}</p>
            <p class="stat__hint">{{ platformSummary() }}</p>
          </div>
          <div class="stat">
            <p class="stat__label">Dormancy runs</p>
            <p class="stat__value">{{ cronRuns().length }}</p>
            <p class="stat__hint">{{ cronRuns()[0] ? ('Last ' + (cronRuns()[0].ranAt | date: 'MMM d, h:mm a')) : 'Never run' }}</p>
          </div>
          <div class="stat">
            <p class="stat__label">Reached last run</p>
            <p class="stat__value">{{ cronRuns()[0]?.sent ?? '—' }}</p>
            @if (cronRuns()[0]; as r) {
              <p class="stat__hint">of {{ r.candidates }} dormant · {{ r.staleRemoved }} stale removed</p>
            }
          </div>
        </div>
      }

      <section class="card" aria-labelledby="compose-title">
        <div class="card-toolbar">
          <h2 id="compose-title" class="section-title text-[15px] leading-6">Send broadcast</h2>
        </div>
        <div class="p-5">
          <app-push-composer
            [appName]="nameFor(slug())"
            [appIcon]="iconFor(slug())"
            [audience]="tokens().length + ' device' + (tokens().length === 1 ? '' : 's')"
            [sending]="sending()"
            [error]="error()"
            [disabledReason]="disabledReason()"
            [(title)]="title_"
            [(body)]="body_"
            (send)="sendBroadcast()" />
        </div>
      </section>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
        <section class="card overflow-hidden" aria-labelledby="devices-title">
          <div class="card-toolbar">
            <h2 id="devices-title" class="section-title text-[15px] leading-6">Registered devices</h2>
            <span class="text-xs text-text2 tabular-nums">{{ tokens().length }}</span>
          </div>
          @if (tokens().length === 0) {
            <app-empty-state icon="smartphone" title="No devices registered yet" body="Devices appear after the app asks for notification permission." />
          } @else {
            <div class="table-scroll max-h-[420px] overflow-y-auto">
              <table class="data-table">
                <thead><tr><th>Install ID</th><th>Platform</th><th>Registered</th><th>Last push</th></tr></thead>
                <tbody>
                  @for (t of tokens(); track t.installId) {
                    <tr>
                      <td class="font-mono text-xs">{{ t.installId.slice(0, 8) }}…</td>
                      <td><span class="badge badge-neutral">{{ t.platform }}</span></td>
                      <td class="text-text2 tabular-nums">{{ t.createdAt | date: 'MMM d, y' }}</td>
                      <td class="text-text2 tabular-nums">{{ t.lastDormancyPushAt ? (t.lastDormancyPushAt | date: 'MMM d') : 'Never' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <section class="card overflow-hidden" aria-labelledby="cron-title">
          <div class="card-toolbar">
            <h2 id="cron-title" class="section-title text-[15px] leading-6">Dormancy check history</h2>
            <button type="button" class="btn btn-secondary btn-sm" (click)="runCronNow()" [disabled]="cronRunning()">
              <app-icon [name]="cronRunning() ? 'loader' : 'repeat'" [size]="14" [class.animate-spin]="cronRunning()" />
              {{ cronRunning() ? 'Running…' : 'Run now' }}
            </button>
          </div>
          @if (cronRuns().length === 0) {
            <app-empty-state icon="repeat" title="No runs yet" body="The cron nudges devices that haven't opened the app in a while." />
          } @else {
            <div class="table-scroll max-h-[420px] overflow-y-auto">
              <table class="data-table">
                <thead><tr><th>Ran at</th><th class="text-right">Candidates</th><th class="text-right">Sent</th><th class="text-right">Stale</th></tr></thead>
                <tbody>
                  @for (r of cronRuns(); track r.id) {
                    <tr>
                      <td class="tabular-nums">{{ r.ranAt | date: 'MMM d, h:mm a' }}</td>
                      <td class="text-right tabular-nums">{{ r.candidates }}</td>
                      <td class="text-right tabular-nums font-semibold" [class.text-success]="r.sent > 0">{{ r.sent }}</td>
                      <td class="text-right tabular-nums text-text2">{{ r.staleRemoved }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      </div>
    </div>
  `,
})
export class PushConsoleComponent implements OnInit {
  private readonly push = inject(PushAdminService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly title = input.required<string>();
  readonly description = input<string>('');
  /** Push app slugs this console can manage; a selector shows when > 1. */
  readonly apps = input.required<string[]>();

  readonly slug = signal('');
  readonly credential = signal<CredentialStatus | null>(null);
  readonly tokens = signal<PushTokenRow[]>([]);
  readonly cronRuns = signal<PushCronRunRow[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');

  title_ = '';
  body_ = '';
  readonly sending = signal(false);
  readonly error = signal('');
  readonly cronRunning = signal(false);

  readonly disabledReason = computed(() => {
    const c = this.credential();
    if (c && !c.configured) return 'Set FIREBASE_SERVICE_ACCOUNT_JSON on the backend first — broadcasting is disabled until then.';
    if (!this.loading() && this.tokens().length === 0) return 'No devices registered for this app yet — nothing to send to.';
    return null;
  });

  readonly platformSummary = computed(() => {
    const counts = new Map<string, number>();
    for (const t of this.tokens()) counts.set(t.platform, (counts.get(t.platform) ?? 0) + 1);
    return [...counts].map(([p, n]) => `${n} ${p}`).join(' · ') || 'No devices';
  });

  ngOnInit(): void {
    this.slug.set(this.apps()[0]);
    this.load();
  }

  nameFor(slug: string): string {
    return findApp(slug)?.name ?? slug;
  }

  iconFor(slug: string): string | null {
    return findApp(slug)?.icon ?? null;
  }

  selectApp(slug: string): void {
    this.slug.set(slug);
    this.load();
  }

  load(): void {
    const slug = this.slug();
    this.loading.set(true);
    this.loadError.set('');
    this.push.getCredentialStatus().subscribe({
      next: (s) => this.credential.set(s),
      error: () => this.loadError.set('Could not load Firebase status.'),
    });
    this.push.listTokens(slug).subscribe({
      next: (rows) => {
        this.tokens.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load registered devices.');
        this.loading.set(false);
      },
    });
    this.loadCronRuns();
  }

  private loadCronRuns(): void {
    this.push.getCronRuns(this.slug()).subscribe({
      next: (rows) => this.cronRuns.set(rows),
      error: () => this.loadError.set('Could not load dormancy check history.'),
    });
  }

  async sendBroadcast(): Promise<void> {
    const title = this.title_.trim();
    const body = this.body_.trim();
    const n = this.tokens().length;
    const ok = await this.confirm.ask({
      title: 'Send broadcast?',
      message: `"${title}" goes to all ${n} registered device${n === 1 ? '' : 's'} right away.`,
      confirmLabel: 'Send now',
    });
    if (!ok) return;
    this.sending.set(true);
    this.error.set('');
    this.push.broadcast(this.slug(), { title, body }).subscribe({
      next: (r) => {
        this.sending.set(false);
        this.title_ = '';
        this.body_ = '';
        this.toast.success(
          `Broadcast sent to ${r.sent} device${r.sent === 1 ? '' : 's'}` +
            (r.failed ? ` · ${r.failed} failed` : '') +
            (r.staleRemoved ? ` · ${r.staleRemoved} stale removed` : ''),
        );
        this.push.listTokens(this.slug()).subscribe({ next: (rows) => this.tokens.set(rows) });
      },
      error: () => {
        this.sending.set(false);
        this.error.set('Broadcast failed. Please try again.');
      },
    });
  }

  runCronNow(): void {
    if (this.cronRunning()) return;
    this.cronRunning.set(true);
    this.push.runCronNow(this.slug()).subscribe({
      next: (r) => {
        this.cronRunning.set(false);
        this.toast.success(
          `Dormancy check ran: ${r.sent} sent` + (r.candidates !== undefined ? ` of ${r.candidates} candidates` : '') + '.',
        );
        this.loadCronRuns();
        this.push.listTokens(this.slug()).subscribe({ next: (rows) => this.tokens.set(rows) });
      },
      error: () => {
        this.cronRunning.set(false);
        this.toast.error('Running the dormancy check failed.');
      },
    });
  }
}
