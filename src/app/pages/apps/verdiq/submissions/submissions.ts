import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { Submission, SubmissionList, SubmissionStatus } from '../../../../core/models/verdiq/submission.model';
import { PermissionService } from '../../../../core/services/permission.service';
import { ToastService } from '../../../../core/services/toast.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { Modal } from '../../../../shared/components/modal/modal';
import { avatarColor, initials } from '../../../../shared/utils/avatar';
import { emailName, matchesQuery, pageOf } from '../../../../shared/utils/client-list';
import { MODERATION_STATUS_LABELS, moderationTone } from '../../../../core/models/verdiq/moderation';

type StatusFilter = SubmissionStatus | 'all';

// Submissions moderation queue. Approve → creates/updates a real product (then
// scoreable); reject → records a reason. Both audit-logged server-side.
// The backend returns up to 200 rows per status, so search and paging are client-side.
@Component({
  selector: 'app-submissions',
  imports: [
    DatePipe, DecimalPipe, FormsModule, EmptyStateComponent, SkeletonComponent, PageHeaderComponent,
    IconComponent, PaginationComponent, Modal,
  ],
  templateUrl: './submissions.html',
})
export class Submissions {
  private api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly perms = inject(PermissionService);

  readonly data = signal<SubmissionList | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly status = signal<StatusFilter>('pending');
  readonly query = signal('');
  readonly page = signal(1);
  readonly pageSize = 20;

  readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'all', label: 'All statuses' },
  ];

  readonly filtered = computed(() => {
    const q = this.query();
    return (this.data()?.rows ?? []).filter((s) =>
      matchesQuery(q, s.name, s.brand, s.barcode, s.category, s.submitter_email),
    );
  });
  readonly rows = computed(() => pageOf(this.filtered(), this.page(), this.pageSize));

  // Review panel
  readonly selected = signal<Submission | null>(null);
  reviewNote = '';
  readonly busy = signal(false);
  readonly canReview = computed(() => this.perms.can('verdiq', 'submissions', 'edit'));

  readonly initials = (email: string | null) => initials(emailName(email) || '?');
  readonly avatarColor = avatarColor;
  readonly tone = moderationTone;
  readonly statusLabel = (s: SubmissionStatus) => MODERATION_STATUS_LABELS[s];
  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getSubmissions(this.status()).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load submissions.');
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

  open(s: Submission): void {
    this.selected.set(s);
    this.reviewNote = '';
  }

  close(): void {
    if (!this.busy()) this.selected.set(null);
  }

  decide(action: 'approve' | 'reject'): void {
    const s = this.selected();
    if (!s) return;
    const label = s.name || s.barcode || 'submission';
    const note = this.reviewNote.trim() || undefined;
    const call = action === 'approve' ? this.api.approveSubmission(s.id, note) : this.api.rejectSubmission(s.id, note);
    this.busy.set(true);
    call.subscribe({
      next: () => {
        this.busy.set(false);
        this.selected.set(null);
        this.toast.success(action === 'approve' ? `Approved "${label}". Product created.` : `Rejected "${label}".`);
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.error(
          e?.status === 404 ? 'Someone already reviewed this submission.' : `Could not ${action} this submission.`,
        );
        if (e?.status === 404) {
          this.selected.set(null);
          this.load();
        }
      },
    });
  }
}
