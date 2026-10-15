import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { RenewloopAdminApi } from '../../../../core/services/renewloop/admin-api';
import { SortBy, SortDir, UsersPage } from '../../../../core/models/renewloop/user.model';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-renewloop-users',
  standalone: true,
  imports: [DatePipe, FormsModule, PageHeaderComponent],
  templateUrl: './users.html',
})
export class RenewloopUsers {
  private api = inject(RenewloopAdminApi);

  readonly page = signal<UsersPage | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  search = '';
  sortBy: SortBy = 'createdAt';
  sortDir: SortDir = 'desc';
  activeFilter: '' | 'true' | 'false' = '';
  currentPage = 1;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getUsers({
        search: this.search.trim() || undefined,
        sortBy: this.sortBy,
        sortDir: this.sortDir,
        hasActiveSubscription: this.activeFilter === '' ? undefined : this.activeFilter === 'true',
        page: this.currentPage,
        limit: 20,
      })
      .subscribe({
        next: (p) => {
          this.page.set(p);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Could not load users.');
          this.loading.set(false);
        },
      });
  }

  onSearch(): void {
    this.currentPage = 1;
    this.load();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.load();
  }

  goToPage(p: number): void {
    this.currentPage = p;
    this.load();
  }
}
