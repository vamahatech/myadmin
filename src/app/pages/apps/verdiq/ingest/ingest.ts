import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { IngestList, IngestRow, IngestStatus } from '../../../../core/models/verdiq/ingest.model';

type Tab = 'pending_review' | 'approved' | 'rejected';

// Ingest review queue: leads scraped by the offline `ingredient-ingest` tool
// from Amazon/Zepto land here as pending_review. Nothing is trusted — the admin
// verifies against source_url, ATTACHES the real barcode (e-commerce rarely
// exposes the EAN, but products/verdicts key on it), then approves into
// `products`. Both actions audit-logged server-side.
@Component({
  selector: 'app-ingest',
  imports: [DatePipe, FormsModule],
  templateUrl: './ingest.html',
  styleUrl: './ingest.sass',
})
export class Ingest {
  private api = inject(AdminApi);

  tab: Tab = 'pending_review';
  readonly data = signal<IngestList | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
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

  approve(r: IngestRow): void {
    // Barcode: the typed value wins, else whatever was scraped.
    const barcode = (this.barcodeEdits[r.id]?.trim() || r.barcode || '').trim();
    if (
      !confirm(
        `Approve "${r.name || barcode || '(no name)'}" into the catalog?` +
          (barcode ? `\nBarcode: ${barcode}` : '\n⚠ No barcode — verdicts can\'t cache without one.'),
      )
    ) {
      return;
    }
    this.busy.set(r.id);
    this.error.set(null);
    this.api.approveIngest(r.id, barcode ? { barcode } : {}).subscribe({
      next: () => {
        this.busy.set(null);
        this.notice.set(`Approved "${r.name || barcode}" — product created/updated.`);
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
        this.notice.set(`Rejected "${r.name || r.source_ref || r.id}".`);
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
