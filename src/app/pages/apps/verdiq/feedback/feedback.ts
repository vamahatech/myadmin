import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { AppFeedback, AppFeedbackList, FeedbackStatus } from '../../../../core/models/verdiq/feedback.model';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

type Tab = 'new' | 'read' | 'all';

// General app feedback — read-only queue, no approve/reject. Marking read is
// just bookkeeping for the admin, not audited (unlike report/submission writes).
@Component({
  selector: 'app-feedback',
  imports: [EmptyStateComponent, SkeletonComponent, IconComponent, PageHeaderComponent, DatePipe],
  templateUrl: './feedback.html',
  styleUrl: './feedback.sass',
})
export class Feedback {
  private api = inject(AdminApi);

  tab: Tab = 'new';
  readonly data = signal<AppFeedbackList | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getFeedback(this.tab).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load feedback.');
        this.loading.set(false);
      },
    });
  }

  setTab(t: Tab): void {
    this.tab = t;
    this.load();
  }

  markRead(f: AppFeedback): void {
    this.busy.set(f.id);
    this.api.markFeedbackRead(f.id).subscribe({
      next: () => {
        this.busy.set(null);
        this.load();
      },
      error: () => {
        this.busy.set(null);
        this.error.set('Could not mark as read.');
      },
    });
  }

  badge(status: FeedbackStatus): string {
    return status;
  }
}
