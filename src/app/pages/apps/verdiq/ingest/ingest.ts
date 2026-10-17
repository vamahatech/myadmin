import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { IngestList, IngestRow, IngestSite, IngestStatus } from '../../../../core/models/verdiq/ingest.model';
import { moderationTone } from '../../../../core/models/verdiq/moderation';
import { PermissionService } from '../../../../core/services/permission.service';
import { ToastService } from '../../../../core/services/toast.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { Modal } from '../../../../shared/components/modal/modal';
import { matchesQuery, pageOf } from '../../../../shared/utils/client-list';

type StatusFilter = IngestStatus | 'all';

const STATUS_LABELS: Record<IngestStatus, string> = {
  pending_review: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  duplicate: 'Duplicate',
};

const SITE_LABELS: Record<IngestSite, string> = {
  amazon_in: 'Amazon IN',
  zepto: 'Zepto',
  blinkit: 'Blinkit',
  other: 'Other',
};

// Ingest review queue: leads scraped by the offline `ingredient-ingest` tool
// from Amazon/Zepto land here as pending_review. Nothing is trusted — the admin
// verifies against source_url, ATTACHES the real barcode (e-commerce rarely
// exposes the EAN, but products/verdicts key on it), then approves into
// `products`. Both actions audit-logged server-side. Search and paging are client-side.
@Component({
  selector: 'app-ingest',
  imports: [
    DatePipe, DecimalPipe, FormsModule, EmptyStateComponent, SkeletonComponent, PageHeaderComponent, IconComponent,
    PaginationComponent, Modal,
  ],
  templateUrl: './ingest.html',
})
export class Ingest {
  private api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly perms = inject(PermissionService);

  readonly data = signal<IngestList | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly status = signal<StatusFilter>('pending_review');
  readonly site = signal<IngestSite | ''>('');
  readonly query = signal('');
  readonly page = signal(1);
  readonly pageSize = 20;

  readonly statusOptions: { value: StatusFilter; label: string }[] = [
    ...(Object.entries(STATUS_LABELS) as [IngestStatus, string][]).map(([value, label]) => ({ value, label })),
    { value: 'all', label: 'All statuses' },
  ];
  readonly siteOptions = (Object.entries(SITE_LABELS) as [IngestSite, string][]).map(([value, label]) => ({ value, label }));

  readonly filtered = computed(() => {
    const q = this.query();
    const site = this.site();
    return (this.data()?.rows ?? []).filter(
      (r) => (!site || r.source_site === site) && matchesQuery(q, r.name, r.brand, r.barcode, r.category, r.source_ref),
    );
  });
  readonly rows = computed(() => pageOf(this.filtered(), this.page(), this.pageSize));

  // Review panel
  readonly selected = signal<IngestRow | null>(null);
  barcode = '';
  reviewNote = '';
  readonly busy = signal(false);
  readonly canReview = computed(() => this.perms.can('verdiq', 'ingest', 'edit'));

  readonly tone = moderationTone;
  readonly statusLabel = (s: IngestStatus) => STATUS_LABELS[s] ?? s;
  readonly siteLabel = (s: IngestSite | string) => SITE_LABELS[s as IngestSite] ?? s;
  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getIngest(this.status()).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load the ingest queue.');
        this.loading.set(false);
      },
    });
  }

  setStatus(v: string): void {
    this.status.set(v as StatusFilter);
    this.page.set(1);
    this.load();
  }

  setSite(v: string): void {
    this.site.set(v as IngestSite | '');
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
    this.site.set('');
    this.setStatus('all');
  }

  open(r: IngestRow): void {
    this.selected.set(r);
    this.barcode = r.barcode ?? '';
    this.reviewNote = '';
  }

  close(): void {
    if (!this.busy()) this.selected.set(null);
  }

  decide(action: 'approve' | 'reject'): void {
    const r = this.selected();
    if (!r) return;
    const barcode = this.barcode.trim();
    const note = this.reviewNote.trim() || undefined;
    const label = r.name || barcode || r.source_ref || 'lead';
    const call =
      action === 'approve'
        ? this.api.approveIngest(r.id, { ...(barcode ? { barcode } : {}), ...(note ? { note } : {}) })
        : this.api.rejectIngest(r.id, note);
    this.busy.set(true);
    call.subscribe({
      next: () => {
        this.busy.set(false);
        this.selected.set(null);
        this.toast.success(action === 'approve' ? `Approved "${label}". Product created or updated.` : `Rejected "${label}".`);
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.error(e?.status === 404 ? 'Someone already reviewed this lead.' : `Could not ${action} this lead.`);
        if (e?.status === 404) {
          this.selected.set(null);
          this.load();
        }
      },
    });
  }
}
