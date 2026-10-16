import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { Submission, SubmissionList, SubmissionStatus } from '../../../../core/models/verdiq/submission.model';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../../core/services/toast.service';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

type Tab = 'pending' | 'approved' | 'rejected';

// Submissions moderation queue. Approve → creates/updates a real product (then
// scoreable); reject → records a reason. Both audit-logged server-side.
@Component({
  selector: 'app-submissions',
  imports: [EmptyStateComponent, SkeletonComponent, PageHeaderComponent, IconComponent, DatePipe],
  templateUrl: './submissions.html',
  styleUrl: './submissions.sass',
})
export class Submissions {
  private api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  tab: Tab = 'pending';
  readonly data = signal<SubmissionList | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getSubmissions(this.tab).subscribe({
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

  setTab(t: Tab): void {
    this.tab = t;
    this.load();
  }

  async approve(s: Submission): Promise<void> {
    if (!(await this.confirm.ask({ title: 'Approve submission?', message: `"${s.name || s.barcode}" will create or update a real product.`, confirmLabel: 'Approve' }))) return;
    this.busy.set(s.id);
    this.api.approveSubmission(s.id).subscribe({
      next: () => {
        this.busy.set(null);
        this.toast.success(`Approved "${s.name || s.barcode}" — product created.`);
        this.load();
      },
      error: () => {
        this.busy.set(null);
        this.error.set('Approve failed.');
      },
    });
  }

  reject(s: Submission): void {
    const note = prompt('Reason for rejecting (optional):') ?? undefined;
    this.busy.set(s.id);
    this.api.rejectSubmission(s.id, note).subscribe({
      next: () => {
        this.busy.set(null);
        this.toast.success(`Rejected "${s.name || s.barcode}".`);
        this.load();
      },
      error: () => {
        this.busy.set(null);
        this.error.set('Reject failed.');
      },
    });
  }

  badge(status: SubmissionStatus): string {
    return status;
  }
}
