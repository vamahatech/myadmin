import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { IngestList, IngestRow, IngestStatus } from '../../../../core/models/verdiq/ingest.model';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../../core/services/toast.service';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

type Tab = 'pending_review' | 'approved' | 'rejected';

// Ingest review queue: leads scraped by the offline `ingredient-ingest` tool
// from Amazon/Zepto land here as pending_review. Nothing is trusted — the admin
// verifies against source_url, ATTACHES the real barcode (e-commerce rarely
// exposes the EAN, but products/verdicts key on it), then approves into
// `products`. Both actions audit-logged server-side.
@Component({
  selector: 'app-ingest',
  imports: [EmptyStateComponent, SkeletonComponent, PageHeaderComponent, IconComponent, DatePipe, FormsModule],
  templateUrl: './ingest.html',
  styleUrl: './ingest.sass',
})
export class Ingest {
  private api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  tab: Tab = 'pending_review';
  readonly data = signal<IngestList | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal<string | null>(null);

  // Per-row barcode the admin types before approving (staged rows lack one).
  // Keyed by row id so each card has its own input.
  readonly barcodeEdits: Record<string, string> = {};

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getIngest(this.tab).subscribe({
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

  setTab(t: Tab): void {
    this.tab = t;
    this.load();
  }

  async approve(r: IngestRow): Promise<void> {
    // Barcode: the typed value wins, else whatever was scraped.
    const barcode = (this.barcodeEdits[r.id]?.trim() || r.barcode || '').trim();
    const ok = await this.confirm.ask({
      title: 'Approve into catalog?',
      message:
        `"${r.name || barcode || '(no name)'}" will be added to the catalog.` +
        (barcode ? `\nBarcode: ${barcode}` : "\nNo barcode — verdicts can't cache without one."),
      confirmLabel: 'Approve',
    });
    if (!ok) {
      return;
    }
    this.busy.set(r.id);
    this.error.set(null);
    this.api.approveIngest(r.id, barcode ? { barcode } : {}).subscribe({
      next: () => {
        this.busy.set(null);
        this.toast.success(`Approved "${r.name || barcode}" — product created/updated.`);
        this.load();
      },
      error: () => {
        this.busy.set(null);
        this.error.set('Approve failed.');
      },
    });
  }

  reject(r: IngestRow): void {
    const note = prompt('Reason for rejecting (optional):') ?? undefined;
    this.busy.set(r.id);
    this.api.rejectIngest(r.id, note).subscribe({
      next: () => {
        this.busy.set(null);
        this.toast.success(`Rejected "${r.name || r.source_ref || r.id}".`);
        this.load();
      },
      error: () => {
        this.busy.set(null);
        this.error.set('Reject failed.');
      },
    });
  }

  siteLabel(site: string): string {
    if (site === 'amazon_in') return 'Amazon IN';
    if (site === 'zepto') return 'Zepto';
    if (site === 'blinkit') return 'Blinkit';
    return site;
  }

  countFor(status: IngestStatus): number {
    return this.data()?.counts[status] ?? 0;
  }
}
