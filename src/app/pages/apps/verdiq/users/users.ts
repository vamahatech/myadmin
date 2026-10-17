import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { VerdiqAuthService } from '../../../../core/services/verdiq/verdiq-auth';
import { PermissionService } from '../../../../core/services/permission.service';
import { UserRow, UsersReport } from '../../../../core/models/verdiq/admin-user.model';
import { Modal } from '../../../../shared/components/modal/modal';
import { ConfirmDeleteModal } from '../../../../shared/components/confirm-delete-modal/confirm-delete-modal';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { IconComponent, IconName } from '../../../../shared/components/icon/icon.component';
import { ToastService } from '../../../../core/services/toast.service';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { avatarColor, initials } from '../../../../shared/utils/avatar';
import { emailName, matchesQuery, pageOf } from '../../../../shared/utils/client-list';

type Filter = 'all' | 'admins' | 'parents' | 'testers' | 'inactive';
type SortBy = 'email' | 'last_seen_at' | 'created_at';

// Users & testers. Overview (list, child counts, tester opt-in, 14-day inactivity
// flag) plus admin account creation — the backend generates + emails a password.
// The endpoint returns every user, so filter, sort and paging are client-side.
@Component({
  selector: 'app-users',
  imports: [
    SkeletonComponent, IconComponent, PageHeaderComponent, DatePipe, DecimalPipe, FormsModule, Modal,
    ConfirmDeleteModal, EmptyStateComponent, PaginationComponent,
  ],
  templateUrl: './users.html',
})
export class Users {
  private api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly perms = inject(PermissionService);
  private auth = inject(VerdiqAuthService);

  readonly data = signal<UsersReport | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // The signed-in Verdiq account's id — used to disable self-delete/self-demote
  // in the UI (the backend also guards this).
  readonly currentUserId = this.auth.user()?.id ?? null;
  /** Account writes (create, role change, delete) are "manage" on Verdiq's users module. */
  readonly canManage = computed(() => this.perms.can('verdiq', 'users', 'manage'));

  readonly filter = signal<Filter>('all');
  readonly query = signal('');
  readonly sortBy = signal<SortBy>('created_at');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly page = signal(1);
  readonly pageSize = 20;

  readonly filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All users' },
    { value: 'parents', label: 'Parents' },
    { value: 'admins', label: 'Admins' },
    { value: 'testers', label: 'Testers' },
    { value: 'inactive', label: 'Inactive testers' },
  ];

  readonly filtered = computed(() => {
    const q = this.query();
    const f = this.filter();
    const by = this.sortBy();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return (this.data()?.rows ?? [])
      .filter((u) => {
        if (f === 'admins' && !u.is_admin) return false;
        if (f === 'parents' && u.is_admin) return false;
        if (f === 'testers' && !u.tester_opted_in) return false;
        if (f === 'inactive' && !u.inactive_tester) return false;
        return matchesQuery(q, u.email);
      })
      .sort((a, b) => {
        // Never-seen users sort last either way.
        const av = a[by] ?? '';
        const bv = b[by] ?? '';
        if (!av && bv) return 1;
        if (av && !bv) return -1;
        return av < bv ? -dir : av > bv ? dir : 0;
      });
  });
  readonly rows = computed(() => pageOf(this.filtered(), this.page(), this.pageSize));

  // Create-user modal.
  readonly createOpen = signal(false);
  newEmail = '';
  newIsAdmin = false;
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);

  // Which row is mid-role-change — disables its button so a double-click can't fire twice.
  readonly roleChangingId = signal<string | null>(null);

  // Delete confirmation dialog state.
  readonly deleteTarget = signal<UserRow | null>(null);

  readonly initials = (email: string) => initials(emailName(email) || '?');
  readonly avatarColor = avatarColor;
  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getUsers().subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load users.');
        this.loading.set(false);
      },
    });
  }

  setFilter(v: string): void {
    this.filter.set(v as Filter);
    this.page.set(1);
  }

  onSearch(v: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.query.set(v);
      this.page.set(1);
    }, 250);
  }

  clearFilters(): void {
    this.query.set('');
    this.setFilter('all');
  }

  sort(by: SortBy): void {
    if (this.sortBy() === by) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(by);
      this.sortDir.set(by === 'email' ? 'asc' : 'desc');
    }
    this.page.set(1);
  }

  sortIcon(by: SortBy): IconName {
    if (this.sortBy() !== by) return 'chevrons-up-down';
    return this.sortDir() === 'asc' ? 'arrow-up' : 'arrow-down';
  }

  ariaSort(by: SortBy): 'ascending' | 'descending' | 'none' {
    if (this.sortBy() !== by) return 'none';
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }

  openCreate(): void {
    this.newEmail = '';
    this.newIsAdmin = false;
    this.createError.set(null);
    this.createOpen.set(true);
  }

  closeCreate(): void {
    this.createOpen.set(false);
  }

  createUser(): void {
    const email = this.newEmail.trim();
    this.createError.set(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.createError.set('Enter a valid email address.');
      return;
    }
    this.creating.set(true);
    this.api.createUser(email, this.newIsAdmin).subscribe({
      next: () => {
        this.creating.set(false);
        this.newEmail = '';
        this.createOpen.set(false);
        this.toast.success(`${this.newIsAdmin ? 'Admin' : 'Account'} created for ${email}. Password emailed.`);
        this.load();
      },
      error: (e) => {
        this.creating.set(false);
        this.createError.set(
          e?.error?.error === 'email_exists' ? 'A user with that email already exists.' : 'Could not create the user.',
        );
      },
    });
  }

  async toggleAdmin(user: UserRow): Promise<void> {
    const makeAdmin = !user.is_admin;
    const ok = await this.confirm.ask({
      title: makeAdmin ? 'Make admin?' : 'Remove admin?',
      message: makeAdmin
        ? `${user.email} will be able to sign in to Verdiq's own admin tools.`
        : `${user.email} will lose Verdiq admin access.`,
      confirmLabel: makeAdmin ? 'Make admin' : 'Remove admin',
      tone: makeAdmin ? 'primary' : 'danger',
    });
    if (!ok) return;
    this.roleChangingId.set(user.id);
    this.api.setUserAdmin(user.id, makeAdmin).subscribe({
      next: () => {
        this.roleChangingId.set(null);
        this.toast.success(makeAdmin ? `${user.email} is now an admin.` : `${user.email} is no longer an admin.`);
        this.load();
      },
      error: (e) => {
        this.roleChangingId.set(null);
        this.toast.error(e?.error?.error === 'last_admin' ? 'Cannot remove the only admin.' : 'Could not change admin status.');
      },
    });
  }

  openDelete(user: UserRow): void {
    this.deleteTarget.set(user);
  }

  closeDelete(): void {
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;
    this.api.deleteUser(target.id).subscribe({
      next: () => {
        this.deleteTarget.set(null);
        this.toast.success(`Deleted ${target.email}.`);
        this.load();
      },
      error: (e) => {
        this.deleteTarget.set(null);
        const code = e?.error?.error;
        this.toast.error(
          code === 'last_admin'
            ? 'Cannot delete the only admin.'
            : code === 'self_delete'
              ? 'Ask another admin to remove your account.'
              : 'Could not delete the user.',
        );
      },
    });
  }
}
