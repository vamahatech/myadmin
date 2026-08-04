import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { ProductReport, ProductReportList, ReportStatus } from '../../../../core/models/verdiq/report.model';

type Tab = 'pending' | 'approved' | 'rejected';

// Product data-accuracy reports queue. Approve is an ACKNOWLEDGMENT ONLY — it
// never touches products/verdicts; the admin fixes the underlying data
// separately via Products/Verdicts. Reject just records a reason. Both
// audit-logged server-side (see routes/admin.ts).
@Component({
  selector: 'app-reports',
  imports: [DatePipe],
  templateUrl: './reports.html',
  styleUrl: './reports.sass',
})
export class Reports {
  private api = inject(AdminApi);

  tab: Tab = 'pending';
  readonly data = signal<ProductReportList | null>(null);
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
    this.api.getReports(this.tab).subscribe({
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

  setTab(t: Tab): void {
    this.tab = t;
    this.load();
  }

  approve(r: ProductReport): void {
    if (!confirm(`Mark this report on "${r.product_name || r.barcode}" as valid? This does not change the product — fix the data separately.`)) return;
    this.busy.set(r.id);
    this.api.approveReport(r.id).subscribe({
      next: () => {
        this.busy.set(null);
        this.notice.set(`Marked valid — remember to fix "${r.product_name || r.barcode}" separately.`);
        this.load();
      },
      error: () => {
        this.busy.set(null);
        this.error.set('Approve failed.');
      },
    });
  }

  reject(r: ProductReport): void {
    const note = prompt('Reason for rejecting (optional):') ?? undefined;
    this.busy.set(r.id);
    this.api.rejectReport(r.id, note).subscribe({
      next: () => {
        this.busy.set(null);
        this.notice.set(`Rejected report on "${r.product_name || r.barcode}".`);
        this.load();
      },
      error: () => {
        this.busy.set(null);
        this.error.set('Reject failed.');
      },
    });
  }

  badge(status: ReportStatus): string {
    return status;
  }

  reasonLabel(reason: ProductReport['reason']): string {
    switch (reason) {
      case 'wrong_ingredients':
        return 'Wrong ingredients';
      case 'wrong_verdict':
        return 'Wrong verdict';
      case 'wrong_info':
        return 'Wrong name/brand/category';
      default:
        return 'Other';
    }
  }
}
