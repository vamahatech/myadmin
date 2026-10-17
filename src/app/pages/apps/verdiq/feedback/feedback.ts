import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';

import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { AppFeedback, AppFeedbackList, FeedbackStatus } from '../../../../core/models/verdiq/feedback.model';
import { moderationTone } from '../../../../core/models/verdiq/moderation';
import { PermissionService } from '../../../../core/services/permission.service';
import { ToastService } from '../../../../core/services/toast.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { Modal } from '../../../../shared/components/modal/modal';
import { avatarColor, initials } from '../../../../shared/utils/avatar';
import { emailName, matchesQuery, pageOf } from '../../../../shared/utils/client-list';

type StatusFilter = FeedbackStatus | 'all';

// General app feedback — no approve/reject. Marking read is just bookkeeping
// for the admin, not audited (unlike report/submission writes).
// Search and paging are client-side (the endpoint returns the list whole).
@Component({
  selector: 'app-feedback',
  imports: [
    DatePipe, DecimalPipe, EmptyStateComponent, SkeletonComponent, IconComponent, PageHeaderComponent,
    PaginationComponent, Modal,
  ],
  templateUrl: './feedback.html',
})
export class Feedback {
  private api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly perms = inject(PermissionService);

  readonly data = signal<AppFeedbackList | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly status = signal<StatusFilter>('new');
  readonly query = signal('');
  readonly page = signal(1);
  readonly pageSize = 20;

  readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'new', label: 'New' },
    { value: 'read', label: 'Read' },
    { value: 'all', label: 'All statuses' },
  ];

  readonly filtered = computed(() => {
    const q = this.query();
    return (this.data()?.rows ?? []).filter((f) => matchesQuery(q, f.note, f.sender_email));
  });
  readonly rows = computed(() => pageOf(this.filtered(), this.page(), this.pageSize));

  readonly selected = signal<AppFeedback | null>(null);
  readonly busy = signal(false);
  readonly canEdit = computed(() => this.perms.can('verdiq', 'feedback', 'edit'));

  readonly initials = (email: string | null) => initials(emailName(email) || '?');
  readonly avatarColor = avatarColor;
  readonly tone = moderationTone;
  readonly statusLabel = (s: FeedbackStatus) => (s === 'new' ? 'New' : 'Read');
  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getFeedback(this.status()).subscribe({
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

  setStatus(v: string): void {
    this.status.set(v as StatusFilter);
    this.page.set(1);
    this.load();
  }

  onSearch(v: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.query.set(v);
      this.page.set(1);
    }, 250);
  }

  clearFilters(): void {
    this.query.set('');
    this.setStatus('all');
  }

  open(f: AppFeedback): void {
    this.selected.set(f);
  }

  close(): void {
    if (!this.busy()) this.selected.set(null);
  }

  markRead(): void {
    const f = this.selected();
    if (!f) return;
    this.busy.set(true);
    this.api.markFeedbackRead(f.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.selected.set(null);
        this.toast.success('Marked as read.');
        this.load();
      },
      error: () => {
        this.busy.set(false);
        this.toast.error('Could not mark this feedback as read.');
      },
    });
  }

  replyLink(f: AppFeedback): string | null {
    if (!f.sender_email) return null;
    return `mailto:${f.sender_email}?subject=${encodeURIComponent('Re: your Verdiq feedback')}`;
  }
}
