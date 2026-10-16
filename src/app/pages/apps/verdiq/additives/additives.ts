import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { Additive } from '../../../../core/models/verdiq/additive.model';
import { Modal } from '../../../../shared/components/modal/modal';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ToastService } from '../../../../core/services/toast.service';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';

// INS additive decode manager — the first WRITE surface. Seed the empty table
// from code in one click, then add / edit / delete entries. Every write is
// audit-logged server-side.
@Component({
  selector: 'app-additives',
  imports: [SkeletonComponent, IconComponent, PageHeaderComponent, FormsModule, Modal],
  templateUrl: './additives.html',
  styleUrl: './additives.sass',
})
export class Additives {
  private api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly rows = signal<Additive[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);

  // Edit/create form state. `editing` holds the INS being edited (null = new).
  // `formOpen` drives the modal — was a top-of-page card, invisible when a
  // row far down a long table was edited (no scroll-to-view, form updated
  // off-screen). A centred modal is visible no matter the scroll position.
  readonly editing = signal<string | null>(null);
  readonly formOpen = signal(false);
  form: Additive = this.blank();

  readonly controversialCount = computed(() => this.rows().filter((r) => r.controversial).length);

  constructor() {
    this.load();
  }

  private blank(): Additive {
    return { ins: '', name: '', risk: '', controversial: false };
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getAdditives().subscribe({
      next: (r) => {
        this.rows.set(r.rows);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load additives.');
        this.loading.set(false);
      },
    });
  }

  seed(): void {
    this.busy.set(true);
    this.api.seedAdditives().subscribe({
      next: (res) => {
        this.busy.set(false);
        this.toast.success(`Seeded ${res.seeded} entries from code — table now has ${res.total}.`);
        this.load();
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Seed failed.');
      },
    });
  }

  startNew(): void {
    this.editing.set(null);
    this.form = this.blank();
    this.formOpen.set(true);
  }

  startEdit(a: Additive): void {
    this.editing.set(a.ins);
    this.form = { ...a };
    this.formOpen.set(true);
  }

  cancel(): void {
    this.editing.set(null);
    this.form = this.blank();
    this.formOpen.set(false);
  }

  save(): void {
    if (!this.form.ins.trim() || !this.form.name.trim() || !this.form.risk.trim()) return;
    this.busy.set(true);
    this.api.upsertAdditive({ ...this.form, ins: this.form.ins.trim() }).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success(`Saved INS ${this.form.ins}.`);
        this.cancel();
        this.load();
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Save failed.');
      },
    });
  }

  async remove(a: Additive): Promise<void> {
    if (!(await this.confirm.ask({ title: 'Delete additive?', message: `INS ${a.ins} — ${a.name} will be removed.`, confirmLabel: 'Delete', tone: 'danger' }))) return;
    this.busy.set(true);
    this.api.deleteAdditive(a.ins).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success(`Deleted INS ${a.ins}.`);
        this.load();
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Delete failed.');
      },
    });
  }
}
