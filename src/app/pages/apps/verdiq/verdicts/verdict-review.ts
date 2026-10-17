import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { PermissionService } from '../../../../core/services/permission.service';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { Modal } from '../../../../shared/components/modal/modal';
import { VerdictLevel, VerdictPage, VerdictRow } from '../../../../core/models/verdiq/verdict.model';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../../core/services/toast.service';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

// Verdict review queue — every cached verdict with its reason, citation, flags,
// and decoded additives, newest first. Admins can RECOMPUTE (re-run the
// deterministic pipeline on stored ingredient text) or OVERRIDE (manually set
// the verdict). Both go through the backend verdict store and are audit-logged.
@Component({
  selector: 'app-verdict-review',
  imports: [EmptyStateComponent, SkeletonComponent, PageHeaderComponent, IconComponent, DatePipe, FormsModule, PaginationComponent, Modal],
  templateUrl: './verdict-review.html',
})
export class VerdictReview {
  private api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly perms = inject(PermissionService);
  readonly canEdit = computed(() => this.perms.can('verdiq', 'verdicts', 'edit'));

  /** The verdict open in the detail panel. */
  readonly selected = signal<VerdictRow | null>(null);

  page = 1;
  readonly pageSize = 25;
  readonly data = signal<VerdictPage | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busyKey = signal<string | null>(null);

  // Which row's override form is open (keyed by barcode::age_band), + its draft.
  readonly editingKey = signal<string | null>(null);
  draft = { verdict: 'Caution' as VerdictLevel, reason: '', citation: '' };
  readonly levels: VerdictLevel[] = ['OK', 'Caution', 'Avoid'];


  constructor() {
    this.load();
  }

  key(v: VerdictRow): string {
    return `${v.barcode}::${v.age_band}`;
  }

  startOverride(v: VerdictRow): void {
    this.editingKey.set(this.key(v));
    this.draft = { verdict: v.verdict, reason: v.reason, citation: v.citation };
  }

  cancelOverride(): void {
    this.editingKey.set(null);
  }

  saveOverride(v: VerdictRow): void {
    if (!this.draft.reason.trim() || !this.draft.citation.trim()) return;
    this.busyKey.set(this.key(v));
    this.api
      .overrideVerdict({
        barcode: v.barcode,
        ageBand: v.age_band,
        verdict: this.draft.verdict,
        reason: this.draft.reason.trim(),
        citation: this.draft.citation.trim(),
      })
      .subscribe({
        next: () => {
          this.busyKey.set(null);
          this.editingKey.set(null);
          this.selected.set(null);
          this.toast.success(`Overrode ${v.product_name || v.barcode} (${this.ageLabel(v.age_band)}).`);
          this.load();
        },
        error: () => {
          this.busyKey.set(null);
          this.toast.error('Override failed.');
        },
      });
  }

  recompute(v: VerdictRow): void {
    this.busyKey.set(this.key(v));
    this.api.recomputeVerdict(v.barcode, v.age_band).subscribe({
      next: () => {
        this.busyKey.set(null);
        this.selected.set(null);
        this.toast.success(`Recomputed ${v.product_name || v.barcode} (${this.ageLabel(v.age_band)}).`);
        this.load();
      },
      error: (err) => {
        this.busyKey.set(null);
        this.toast.error(err?.error?.message ?? 'Recompute failed (product may have no ingredient text).');
      },
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getVerdicts(this.page, this.pageSize).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load verdicts.');
        this.loading.set(false);
      },
    });
  }

  goToPage(p: number): void {
    this.page = p;
    this.load();
  }

  open(v: VerdictRow): void {
    this.editingKey.set(null);
    this.selected.set(v);
  }

  close(): void {
    if (!this.busyKey()) this.selected.set(null);
  }

  tone(level: VerdictLevel): string {
    return level === 'OK' ? 'badge-success' : level === 'Caution' ? 'badge-warning' : 'badge-danger';
  }

  controversialCount(v: VerdictRow): number {
    return v.additives.filter((a) => a.controversial).length;
  }

  ageLabel(band: string): string {
    return band === 'under_2' ? 'Under 2' : band === '2_to_5' ? '2–5' : band;
  }
}
