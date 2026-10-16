import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ToastService } from '../../../../core/services/toast.service';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import {
  DoubleStandardInput,
  DoubleStandardRow,
} from '../../../../core/models/verdiq/double-standard.model';

// Double-standard manager. A pair is a public accusation, so it only ships once
// verified. Admins draft/edit here, then verify. All writes audit-logged.
@Component({
  selector: 'app-double-standards',
  imports: [SkeletonComponent, IconComponent, PageHeaderComponent, DatePipe, FormsModule],
  templateUrl: './double-standards.html',
  styleUrl: './double-standards.sass',
})
export class DoubleStandards {
  private api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly rows = signal<DoubleStandardRow[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal<string | null>(null);

  readonly editing = signal<string | null>(null);
  form: DoubleStandardInput = this.blank();

  readonly verifiedCount = computed(() => this.rows().filter((r) => r.verified).length);
  readonly draftCount = computed(() => this.rows().filter((r) => !r.verified).length);

  constructor() {
    this.load();
  }

  private blank(): DoubleStandardInput {
    return {
      barcode: '',
      nutrient: '',
      indiaValue: '',
      foreignMarket: 'UK',
      foreignValue: '',
      source: '',
      verified: false,
    };
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getDoubleStandards().subscribe({
      next: (r) => {
        this.rows.set(r.rows);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load double standards.');
        this.loading.set(false);
      },
    });
  }

  startNew(): void {
    this.editing.set(null);
    this.form = this.blank();
  }

  startEdit(r: DoubleStandardRow): void {
    this.editing.set(r.barcode);
    this.form = {
      barcode: r.barcode,
      nutrient: r.nutrient,
      indiaValue: r.india_value,
      foreignMarket: r.foreign_market,
      foreignValue: r.foreign_value,
      source: r.source,
      verified: r.verified,
    };
  }

  cancel(): void {
    this.editing.set(null);
    this.form = this.blank();
  }

  private valid(): boolean {
    const f = this.form;
    return !!(
      f.barcode.trim() &&
      f.nutrient.trim() &&
      f.indiaValue.trim() &&
      f.foreignMarket.trim() &&
      f.foreignValue.trim() &&
      f.source.trim()
    );
  }

  save(): void {
    if (!this.valid()) return;
    this.busy.set('form');
    this.api.upsertDoubleStandard({ ...this.form, barcode: this.form.barcode.trim() }).subscribe({
      next: () => {
        this.busy.set(null);
        this.toast.success(`Saved pair for ${this.form.barcode}.`);
        this.cancel();
        this.load();
      },
      error: () => {
        this.busy.set(null);
        this.error.set('Save failed.');
      },
    });
  }

  async toggleVerify(r: DoubleStandardRow): Promise<void> {
    const next = !r.verified;
    if (next && !(await this.confirm.ask({ title: 'Verify and publish?', message: `The pair for ${r.product_name || r.barcode} will be shown to users.`, confirmLabel: 'Verify & publish' }))) {
      return;
    }
    this.busy.set(r.barcode);
    this.api.verifyDoubleStandard(r.barcode, next).subscribe({
      next: () => {
        this.busy.set(null);
        this.toast.success(next ? `Verified & published ${r.barcode}.` : `Unpublished ${r.barcode}.`);
        this.load();
      },
      error: () => {
        this.busy.set(null);
        this.error.set('Verify toggle failed.');
      },
    });
  }

  async remove(r: DoubleStandardRow): Promise<void> {
    if (!(await this.confirm.ask({ title: 'Delete pair?', message: `The double-standard pair for ${r.product_name || r.barcode} will be removed.`, confirmLabel: 'Delete', tone: 'danger' }))) return;
    this.busy.set(r.barcode);
    this.api.deleteDoubleStandard(r.barcode).subscribe({
      next: () => {
        this.busy.set(null);
        this.toast.success(`Deleted ${r.barcode}.`);
        this.load();
      },
      error: () => {
        this.busy.set(null);
        this.error.set('Delete failed.');
      },
    });
  }
}
