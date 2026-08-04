import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { Additive } from '../../../../core/models/verdiq/additive.model';
import { Modal } from '../../../../shared/components/verdiq/modal/modal';

// INS additive decode manager — the first WRITE surface. Seed the empty table
// from code in one click, then add / edit / delete entries. Every write is
// audit-logged server-side.
@Component({
  selector: 'app-additives',
  imports: [FormsModule, Modal],
  templateUrl: './additives.html',
  styleUrl: './additives.sass',
})
export class Additives {
  private api = inject(AdminApi);

  readonly rows = signal<Additive[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly notice = signal<string | null>(null);

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
    this.notice.set(null);
    this.api.seedAdditives().subscribe({
      next: (res) => {
        this.busy.set(false);
        this.notice.set(`Seeded ${res.seeded} entries from code — table now has ${res.total}.`);
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
        this.notice.set(`Saved INS ${this.form.ins}.`);
        this.cancel();
        this.load();
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Save failed.');
      },
    });
  }

  remove(a: Additive): void {
    if (!confirm(`Delete INS ${a.ins} — ${a.name}?`)) return;
    this.busy.set(true);
    this.api.deleteAdditive(a.ins).subscribe({
      next: () => {
        this.busy.set(false);
        this.notice.set(`Deleted INS ${a.ins}.`);
        this.load();
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Delete failed.');
      },
    });
  }
}
