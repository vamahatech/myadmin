import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { PermissionService } from '../../../../core/services/permission.service';
import { ProductPage, ProductRow, SearchField } from '../../../../core/models/verdiq/product.model';
import { ConfirmDeleteModal } from '../../../../shared/components/confirm-delete-modal/confirm-delete-modal';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';

// Searchable, filterable, paged product grid. The "incomplete" toggle surfaces
// the null-nutrition backfill worklist directly.
@Component({
  selector: 'app-products-list',
  imports: [DecimalPipe, PaginationComponent, EmptyStateComponent, SkeletonComponent, IconComponent, PageHeaderComponent, FormsModule, RouterLink, ConfirmDeleteModal],
  templateUrl: './products-list.html',
})
export class ProductsList {
  private api = inject(AdminApi);
  private readonly perms = inject(PermissionService);
  readonly canEdit = computed(() => this.perms.can('verdiq', 'products', 'edit'));
  readonly canDelete = computed(() => this.perms.can('verdiq', 'products', 'manage'));
  private searchTimer?: ReturnType<typeof setTimeout>;

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


  constructor() {
    // ?q= lets other pages (e.g. Reports) open the list already searched.
    this.q = inject(ActivatedRoute).snapshot.queryParamMap.get('q') ?? '';
    this.load();
  }

  onSearch(v: string): void {
    this.q = v;
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.applyFilters(), 300);
  }

  setField(v: string): void {
    this.field = v as SearchField | '';
    if (this.q.trim()) this.applyFilters();
  }

  setIncomplete(v: string): void {
    this.incompleteOnly = v === 'incomplete';
    this.applyFilters();
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


  goToPage(p: number): void {
    this.page = p;
    this.load();
  }

  clearFilters(): void {
    this.q = '';
    this.field = '';
    this.incompleteOnly = false;
    this.applyFilters();
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
