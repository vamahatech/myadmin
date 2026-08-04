import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { Submission, SubmissionList, SubmissionStatus } from '../../../../core/models/verdiq/submission.model';

type Tab = 'pending' | 'approved' | 'rejected';

// Submissions moderation queue. Approve → creates/updates a real product (then
// scoreable); reject → records a reason. Both audit-logged server-side.
@Component({
  selector: 'app-submissions',
  imports: [DatePipe],
  templateUrl: './submissions.html',
  styleUrl: './submissions.sass',
})
export class Submissions {
  private api = inject(AdminApi);

  tab: Tab = 'pending';
  readonly data = signal<SubmissionList | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
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

  approve(s: Submission): void {
    if (!confirm(`Approve "${s.name || s.barcode}"? This creates/updates a real product.`)) return;
    this.busy.set(s.id);
    this.api.approveSubmission(s.id).subscribe({
      next: () => {
        this.busy.set(null);
        this.notice.set(`Approved "${s.name || s.barcode}" — product created.`);
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
        this.notice.set(`Rejected "${s.name || s.barcode}".`);
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
