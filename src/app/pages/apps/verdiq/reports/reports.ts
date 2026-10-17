import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { ProductReport, ProductReportList, ReportReason, ReportStatus } from '../../../../core/models/verdiq/report.model';
import { MODERATION_STATUS_LABELS, moderationTone } from '../../../../core/models/verdiq/moderation';
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

type StatusFilter = ReportStatus | 'all';

const REASON_LABELS: Record<ReportReason, string> = {
  wrong_ingredients: 'Wrong ingredients',
  wrong_verdict: 'Wrong verdict',
  wrong_info: 'Wrong name/brand/category',
  other: 'Other',
};

// Product data-accuracy reports queue. Approve is an ACKNOWLEDGMENT ONLY — it
// never touches products/verdicts; the admin fixes the underlying data
// separately via Products/Verdicts. Reject just records a reason. Both
// audit-logged server-side. Up to 200 rows per status; search and paging are client-side.
@Component({
  selector: 'app-reports',
  imports: [
    DatePipe, DecimalPipe, FormsModule, RouterLink, EmptyStateComponent, SkeletonComponent, PageHeaderComponent,
    IconComponent, PaginationComponent, Modal,
  ],
  templateUrl: './reports.html',
})
export class Reports {
  private api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly perms = inject(PermissionService);

  readonly data = signal<ProductReportList | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly status = signal<StatusFilter>('pending');
  readonly reason = signal<ReportReason | ''>('');
  readonly query = signal('');
  readonly page = signal(1);
  readonly pageSize = 20;

  readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Marked valid' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'all', label: 'All statuses' },
  ];
  readonly reasonOptions = (Object.entries(REASON_LABELS) as [ReportReason, string][]).map(([value, label]) => ({ value, label }));

  readonly filtered = computed(() => {
    const q = this.query();
    const reason = this.reason();
    return (this.data()?.rows ?? []).filter(
      (r) => (!reason || r.reason === reason) && matchesQuery(q, r.product_name, r.barcode, r.note, r.reporter_email),
    );
  });
  readonly rows = computed(() => pageOf(this.filtered(), this.page(), this.pageSize));

  readonly selected = signal<ProductReport | null>(null);
  reviewNote = '';
  readonly busy = signal(false);
  readonly canReview = computed(() => this.perms.can('verdiq', 'reports', 'edit'));

  readonly initials = (email: string | null) => initials(emailName(email) || '?');
  readonly avatarColor = avatarColor;
  readonly tone = moderationTone;
  readonly reasonLabel = (r: ReportReason) => REASON_LABELS[r] ?? 'Other';
  readonly statusLabel = (s: ReportStatus) => (s === 'approved' ? 'Valid' : MODERATION_STATUS_LABELS[s]);
  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getReports(this.status()).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load reports.');
        this.loading.set(false);
      },
    });
  }

  setStatus(v: string): void {
    this.status.set(v as StatusFilter);
    this.page.set(1);
    this.load();
  }

  setReason(v: string): void {
    this.reason.set(v as ReportReason | '');
    this.page.set(1);
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
    this.reason.set('');
    this.setStatus('all');
  }

  open(r: ProductReport): void {
    this.selected.set(r);
    this.reviewNote = '';
  }

  close(): void {
    if (!this.busy()) this.selected.set(null);
  }

  decide(action: 'approve' | 'reject'): void {
    const r = this.selected();
    if (!r) return;
    const label = r.product_name || r.barcode;
    const note = this.reviewNote.trim() || undefined;
    const call = action === 'approve' ? this.api.approveReport(r.id, note) : this.api.rejectReport(r.id, note);
    this.busy.set(true);
    call.subscribe({
      next: () => {
        this.busy.set(false);
        this.selected.set(null);
        this.toast.success(
          action === 'approve' ? `Marked valid. Remember to fix "${label}" separately.` : `Rejected the report on "${label}".`,
        );
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.error(e?.status === 404 ? 'Someone already reviewed this report.' : 'Could not save the decision.');
        if (e?.status === 404) {
          this.selected.set(null);
          this.load();
        }
      },
    });
  }
}
