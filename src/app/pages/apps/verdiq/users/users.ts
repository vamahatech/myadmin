import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { VerdiqAuthService } from '../../../../core/services/verdiq/verdiq-auth';
import { UserRow, UsersReport } from '../../../../core/models/verdiq/admin-user.model';
import { Modal } from '../../../../shared/components/modal/modal';
import { ConfirmDeleteModal } from '../../../../shared/components/confirm-delete-modal/confirm-delete-modal';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ToastService } from '../../../../core/services/toast.service';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';

// Users & testers. Overview (list, child counts, tester opt-in, 14-day inactivity
// flag) plus admin account creation — the backend generates + emails a password.
@Component({
  selector: 'app-users',
  imports: [SkeletonComponent, IconComponent, PageHeaderComponent, DatePipe, DecimalPipe, FormsModule, Modal, ConfirmDeleteModal],
  templateUrl: './users.html',
  styleUrl: './users.sass',
})
export class Users {
  private api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private auth = inject(VerdiqAuthService);

  readonly data = signal<UsersReport | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // The signed-in admin's own id — used to disable self-delete/self-demote
  // in the UI (the backend also guards this; this just avoids a round-trip
  // to discover a click was never going to work).
  readonly currentUserId = this.auth.user()?.id ?? null;

  // Create-user form. Was a card pinned above the table — easy to lose track
  // of once you'd scrolled down into a long list. Now a modal, opened on demand.
  readonly createOpen = signal(false);
  newEmail = '';
  newIsAdmin = false;
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);

  // Which row is mid-role-change — disables its button so a double-click
  // can't fire twice.
  readonly roleChangingId = signal<string | null>(null);

  // Delete confirmation dialog state.
  readonly deleteTarget = signal<UserRow | null>(null);
  readonly deleting = signal(false);

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
        this.toast.success(`${this.newIsAdmin ? 'Admin' : 'Account'} created for ${email} — password emailed.`);
        this.load();
      },
      error: (e) => {
        this.creating.set(false);
        this.createError.set(
          e?.error?.error === 'email_exists'
            ? 'A user with that email already exists.'
            : 'Could not create the user.',
        );
      },
    });
  }

  toggleAdmin(user: UserRow): void {
    this.error.set(null);
    this.roleChangingId.set(user.id);
    this.api.setUserAdmin(user.id, !user.is_admin).subscribe({
      next: () => {
        this.roleChangingId.set(null);
        this.toast.success(user.is_admin ? `${user.email} is no longer an admin.` : `${user.email} is now an admin.`,);
        this.load();
      },
      error: (e) => {
        this.roleChangingId.set(null);
        this.error.set(
          e?.error?.error === 'last_admin'
            ? 'Cannot remove the only admin.'
            : 'Could not change admin status.',
        );
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
    this.error.set(null);
    this.deleting.set(true);
    this.api.deleteUser(target.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        this.toast.success(`Deleted ${target.email}.`);
        this.load();
      },
      error: (e) => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        const code = e?.error?.error;
        this.error.set(
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
