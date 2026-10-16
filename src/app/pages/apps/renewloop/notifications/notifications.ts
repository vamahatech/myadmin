import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';

import { RenewloopAdminApi } from '../../../../core/services/renewloop/admin-api';
import { UserRow } from '../../../../core/models/renewloop/user.model';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PushComposerComponent } from '../../../../shared/components/push-composer/push-composer.component';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';

type Audience = 'all' | 'users';

@Component({
  selector: 'app-renewloop-notifications',
  standalone: true,
  imports: [PageHeaderComponent, IconComponent, PushComposerComponent],
  templateUrl: './notifications.html',
})
export class RenewloopNotifications {
  private api = inject(RenewloopAdminApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly audience = signal<Audience>('all');
  title = '';
  body = '';
  readonly sending = signal(false);
  readonly error = signal('');

  readonly userSearch = signal('');
  readonly userResults = signal<UserRow[]>([]);
  readonly userSearchLoading = signal(false);
  readonly selectedUsers = signal<UserRow[]>([]);
  private readonly search$ = new Subject<string>();

  readonly audienceLabel = computed(() => {
    if (this.audience() === 'all') return 'every user with a registered device';
    const n = this.selectedUsers().length;
    return `${n} selected user${n === 1 ? '' : 's'}`;
  });

  readonly disabledReason = computed(() =>
    this.audience() === 'users' && this.selectedUsers().length === 0 ? 'Pick at least one recipient above.' : null,
  );

  constructor() {
    // Users page "Notify" hands over recipients via navigation state.
    const recipients = (globalThis.history?.state as { recipients?: UserRow[] } | undefined)?.recipients;
    if (recipients?.length) {
      this.audience.set('users');
      this.selectedUsers.set(recipients);
    }

    this.search$
      .pipe(debounceTime(300), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((term) => this.searchUsers(term));
  }

  setAudience(a: Audience): void {
    this.audience.set(a);
    this.error.set('');
  }

  onSearch(term: string): void {
    this.userSearch.set(term);
    this.search$.next(term);
  }

  private searchUsers(term: string): void {
    const t = term.trim();
    if (!t) {
      this.userResults.set([]);
      return;
    }
    this.userSearchLoading.set(true);
    this.api.getUsers({ search: t, limit: 8 }).subscribe({
      next: (page) => {
        this.userResults.set(page.users);
        this.userSearchLoading.set(false);
      },
      error: () => this.userSearchLoading.set(false),
    });
  }

  toggleUser(user: UserRow): void {
    const current = this.selectedUsers();
    const exists = current.some((u) => u.id === user.id);
    this.selectedUsers.set(exists ? current.filter((u) => u.id !== user.id) : [...current, user]);
  }

  isSelected(user: UserRow): boolean {
    return this.selectedUsers().some((u) => u.id === user.id);
  }

  async send(): Promise<void> {
    const title = this.title.trim();
    const body = this.body.trim();
    const toAll = this.audience() === 'all';
    const ok = await this.confirm.ask({
      title: toAll ? 'Send to everyone?' : 'Send to selected users?',
      message: `"${title}" goes to ${this.audienceLabel()} right away.`,
      confirmLabel: 'Send now',
    });
    if (!ok) return;

    this.sending.set(true);
    this.error.set('');
    const req = toAll
      ? this.api.broadcastPush(title, body)
      : this.api.sendPushToUsers(this.selectedUsers().map((u) => u.id), title, body);
    req.subscribe({
      next: (r) => {
        this.sending.set(false);
        this.title = '';
        this.body = '';
        if (!toAll) this.selectedUsers.set([]);
        this.toast.success(`Delivered to ${r.successCount}` + (r.failureCount ? ` · ${r.failureCount} failed` : '') + '.');
      },
      error: (e) => {
        this.sending.set(false);
        this.error.set(e?.error?.errors?.[0] ?? 'Sending failed. Please try again.');
      },
    });
  }
}
