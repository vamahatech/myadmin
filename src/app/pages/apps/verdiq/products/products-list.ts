import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { ProductPage, ProductRow, SearchField } from '../../../../core/models/verdiq/product.model';
import { ConfirmDeleteModal } from '../../../../shared/components/verdiq/confirm-delete-modal/confirm-delete-modal';

// Searchable, filterable, paged product grid. The "incomplete" toggle surfaces
// the null-nutrition backfill worklist directly.
@Component({
  selector: 'app-products-list',
  imports: [DecimalPipe, FormsModule, RouterLink, ConfirmDeleteModal],
  templateUrl: './products-list.html',
  styleUrl: './products-list.sass',
})
export class ProductsList {
  private api = inject(AdminApi);

  q = '';
  // Search scope. '' → search all columns (search unaffected by the dropdown).
  field: SearchField | '' = '';
  readonly fields: { value: SearchField | ''; label: string }[] = [
    { value: '', label: 'All fields' },
    { value: 'name', label: 'Name' },
    { value: 'brand', label: 'Brand' },
    { value: 'category', label: 'Category' },
    { value: 'barcode', label: 'Barcode' },
  ];
  incompleteOnly = false;
  page = 1;
  readonly pageSize = 25;

  readonly data = signal<ProductPage | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly totalPages = computed(() => {
    const d = this.data();
    return d ? Math.max(1, Math.ceil(d.total / d.pageSize)) : 1;
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getProducts({
        q: this.q.trim() || undefined,
        // Only send a field when one is chosen — empty dropdown = search all.
        field: this.field || undefined,
        incomplete: this.incompleteOnly || undefined,
        page: this.page,
        pageSize: this.pageSize,
      })
      .subscribe({
        next: (d) => {
          this.data.set(d);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Could not load products.');
          this.loading.set(false);
        },
      });
  }

  // Reset to page 1 whenever the filter/search changes.
  applyFilters(): void {
    this.page = 1;
    this.load();
  }

  prev(): void {
    if (this.page > 1) {
      this.page--;
      this.load();
    }
  }

  next(): void {
    if (this.page < this.totalPages()) {
      this.page++;
      this.load();
    }
  }

  // Which row is mid-delete — disables its button so a double-click can't fire twice.
  readonly deletingId = signal<string | null>(null);

  // Delete confirmation dialog state (type-to-confirm, replacing a bare
  // browser confirm() — see ConfirmDeleteModal).
  readonly deleteTarget = signal<ProductRow | null>(null);

  // What the admin must type: the product's name, or its barcode if it has
  // no name — never a blank string, which would let the confirm button
  // enable with nothing typed.
  deleteLabel(row: ProductRow): string {
    return row.name || row.barcode || 'this product';
  }

  openDelete(row: ProductRow): void {
    this.deleteTarget.set(row);
  }

  closeDelete(): void {
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const row = this.deleteTarget();
    if (!row) return;
    this.deleteTarget.set(null);
    this.deletingId.set(row.id);
    this.api.deleteProduct(row.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.load();
      },
      error: () => {
        this.deletingId.set(null);
        this.error.set('Could not delete product.');
      },
    });
  }
}
