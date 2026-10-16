import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { AlternativeInput, AlternativeRow } from '../../../../core/models/verdiq/alternative.model';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../../core/services/toast.service';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';

// Screen-3 alternatives curation: homemade swaps (P1-4) + cleaner packaged SKU
// (P1-5). A barcode can have several rows (per kind + age band), so this is
// add-row / delete-by-id, not upsert. All writes audit-logged server-side.
//
// ⚠ Homemade swaps must be allergy-aware — the note field must carry any
// allergen caveat (a swap that ignores a common allergen is dangerous).
// ⚠ Cleaner-SKU picks must be evidence-based with NO commercial input.
@Component({
  selector: 'app-alternatives',
  imports: [SkeletonComponent, PageHeaderComponent, IconComponent, DatePipe, FormsModule],
  templateUrl: './alternatives.html',
  styleUrl: './alternatives.sass',
})
export class Alternatives {
  private api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly rows = signal<AlternativeRow[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal<string | null>(null);

  filterBarcode = '';
  form: AlternativeInput = this.blank();

  readonly homemadeCount = computed(() => this.rows().filter((r) => r.kind === 'homemade').length);
  readonly packagedCount = computed(() => this.rows().filter((r) => r.kind === 'packaged').length);

  constructor() {
    this.load();
  }

  private blank(): AlternativeInput {
    return { barcode: '', ageBand: 'under_2', kind: 'homemade', name: '', note: '' };
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getAlternatives(this.filterBarcode.trim() || undefined).subscribe({
      next: (r) => {
        this.rows.set(r.rows);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load alternatives.');
        this.loading.set(false);
      },
    });
  }

  private valid(): boolean {
    const f = this.form;
    return !!(f.barcode.trim() && f.name.trim() && f.note.trim());
  }

  add(): void {
    if (!this.valid()) {
      this.error.set('Barcode, name, and note are all required.');
      return;
    }
    this.busy.set('form');
    this.error.set(null);
    this.api
      .addAlternative({ ...this.form, barcode: this.form.barcode.trim() })
      .subscribe({
        next: () => {
          this.busy.set(null);
          this.toast.success(`Added ${this.form.kind} alternative for ${this.form.barcode}.`);
          // Keep barcode/age band/kind so adding several to one product is fast.
          this.form = { ...this.form, name: '', note: '' };
          this.load();
        },
        error: () => {
          this.busy.set(null);
          this.error.set('Add failed.');
        },
      });
  }

  async remove(r: AlternativeRow): Promise<void> {
    if (!(await this.confirm.ask({ title: 'Delete alternative?', message: `The ${r.kind} alternative "${r.name}" will be removed.`, confirmLabel: 'Delete', tone: 'danger' }))) return;
    this.busy.set(r.id);
    this.api.deleteAlternative(r.id).subscribe({
      next: () => {
        this.busy.set(null);
        this.toast.success('Deleted.');
        this.load();
      },
      error: () => {
        this.busy.set(null);
        this.error.set('Delete failed.');
      },
    });
  }

  ageLabel(b: string): string {
    return b === 'under_2' ? 'Under 2' : '2–5';
  }
}
