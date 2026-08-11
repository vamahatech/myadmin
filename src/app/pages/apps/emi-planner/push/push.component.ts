import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { PushAdminService } from '../../../../core/services/push-admin.service';
import {
  BroadcastResult,
  CredentialStatus,
  PushCronRunRow,
  PushTokenRow,
} from '../../../../models/push-admin.model';

const APP_SLUG = 'emi-planner';

@Component({
  selector: 'app-emi-push',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './push.component.html',
})
export class PushComponent implements OnInit {
  private readonly push = inject(PushAdminService);
  private readonly meta = inject(Meta);

  readonly credential = signal<CredentialStatus | null>(null);
  readonly tokens = signal<PushTokenRow[]>([]);
  readonly cronRuns = signal<PushCronRunRow[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');

  broadcastTitle = '';
  broadcastBody = '';
  readonly broadcastStatus = signal<'idle' | 'sending' | 'error'>('idle');
  readonly broadcastResult = signal<BroadcastResult | null>(null);
  readonly broadcastError = signal('');
  readonly lastActionLabel = signal<'broadcast' | 'cron' | null>(null);
  readonly cronRunning = signal(false);

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    this.load();
  }

  private refreshTokens(): void {
    this.push.listTokens(APP_SLUG).subscribe({
      next: (rows) => this.tokens.set(rows),
      error: () => this.loadError.set('Could not refresh registered devices.'),
    });
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.push.getCredentialStatus().subscribe({
      next: (status) => this.credential.set(status),
      error: () => this.loadError.set('Could not load credential status.'),
    });
    this.push.listTokens(APP_SLUG).subscribe({
      next: (rows) => {
        this.tokens.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load registered devices.');
        this.loading.set(false);
      },
    });
    this.push.getCronRuns(APP_SLUG).subscribe({
      next: (rows) => this.cronRuns.set(rows),
      error: () => this.loadError.set('Could not load cron run history.'),
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
          error: () => this.loadError.set('Could not load cron run history.'),
        });
        this.broadcastResult.set(result);
        this.lastActionLabel.set('cron');
        this.refreshTokens();
      },
      error: () => {
        this.cronRunning.set(false);
        this.loadError.set('Running the dormancy check failed.');
      },
    });
  }
}
