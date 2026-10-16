import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { RenewloopAdminApi } from '../../../../core/services/renewloop/admin-api';
import { ToastService } from '../../../../core/services/toast.service';
import {
  FEEDBACK_CATEGORY_LABELS, FEEDBACK_STATUS_LABELS, FeedbackCategory, FeedbackItem, FeedbackPage, FeedbackStatus, statusTone,
} from '../../../../core/models/renewloop/support.model';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { Modal } from '../../../../shared/components/modal/modal';
import { avatarColor, initials } from '../../../../shared/utils/avatar';

type StatusFilter = FeedbackStatus | 'open' | '';

@Component({
  selector: 'app-renewloop-feedback',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FormsModule, PageHeaderComponent, SkeletonComponent, IconComponent,
    EmptyStateComponent, PaginationComponent, Modal,
  ],
  templateUrl: './feedback.html',
})
export class RenewloopFeedback {
  private api = inject(RenewloopAdminApi);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly page = signal<FeedbackPage | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly status = signal<StatusFilter>('open');
  readonly category = signal<FeedbackCategory | ''>('');
  currentPage = 1;
  readonly pageSize = 20;

  readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'open', label: 'Open (new + investigating)' },
    { value: '', label: 'All statuses' },
    ...(Object.entries(FEEDBACK_STATUS_LABELS) as [FeedbackStatus, string][]).map(([value, label]) => ({ value, label })),
  ];
  readonly categoryOptions = (Object.entries(FEEDBACK_CATEGORY_LABELS) as [FeedbackCategory, string][]).map(
    ([value, label]) => ({ value, label }),
  );
  readonly editStatuses = Object.entries(FEEDBACK_STATUS_LABELS) as [FeedbackStatus, string][];

  // Detail / triage panel
  readonly selected = signal<FeedbackItem | null>(null);
  editStatus: FeedbackStatus = 'new';
  editNote = '';
  readonly saving = signal(false);

  readonly initials = initials;
  readonly avatarColor = avatarColor;
  readonly tone = statusTone;
  readonly categoryLabel = (c: FeedbackCategory) => FEEDBACK_CATEGORY_LABELS[c] ?? c;
  readonly statusLabel = (s: FeedbackStatus) => FEEDBACK_STATUS_LABELS[s] ?? s;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getFeedback({
        status: this.status() || undefined,
        category: this.category() || undefined,
        page: this.currentPage,
        limit: this.pageSize,
      })
      .subscribe({
        next: (p) => {
          this.page.set(p);
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
    this.reset();
  }

  setCategory(v: string): void {
    this.category.set(v as FeedbackCategory | '');
    this.reset();
  }

  clearFilters(): void {
    this.status.set('');
    this.category.set('');
    this.reset();
  }

  goToPage(p: number): void {
    this.currentPage = p;
    this.load();
  }

  open(item: FeedbackItem): void {
    this.selected.set(item);
    this.editStatus = item.status;
    this.editNote = item.resolutionNote ?? '';
  }

  close(): void {
    this.selected.set(null);
  }

  save(): void {
    const item = this.selected();
    if (!item) return;
    this.saving.set(true);
    this.api.updateFeedback(item.id, { status: this.editStatus, resolutionNote: this.editNote.trim() || null }).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.toast.success(`Marked as ${this.statusLabel(updated.status).toLowerCase()}.`);
        this.selected.set(null);
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(e?.error?.errors?.[0] ?? 'Could not update this feedback.');
      },
    });
  }

  viewActivity(userId: string): void {
    this.router.navigate(['/apps/renewloop/activity'], { queryParams: { userId } });
  }

  replyLink(item: FeedbackItem): string | null {
    if (!item.user) return null;
    const subject = encodeURIComponent(`Re: your RenewLoop feedback`);
    return `mailto:${item.user.email}?subject=${subject}`;
  }

  private reset(): void {
    this.currentPage = 1;
    this.load();
  }
}
