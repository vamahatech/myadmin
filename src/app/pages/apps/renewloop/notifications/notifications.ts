import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { RenewloopAdminApi } from '../../../../core/services/renewloop/admin-api';
import { SendNotificationResult, UserRow } from '../../../../core/models/renewloop/user.model';

@Component({
  selector: 'app-renewloop-notifications',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './notifications.html',
})
export class RenewloopNotifications {
  private api = inject(RenewloopAdminApi);

  broadcastTitle = '';
  broadcastBody = '';
  readonly broadcastStatus = signal<'idle' | 'sending' | 'error'>('idle');
  readonly broadcastResult = signal<SendNotificationResult | null>(null);
  readonly broadcastError = signal('');

  userSearch = '';
  readonly userResults = signal<UserRow[]>([]);
  readonly userSearchLoading = signal(false);
  readonly selectedUsers = signal<UserRow[]>([]);
  targetedTitle = '';
  targetedBody = '';
  readonly targetedStatus = signal<'idle' | 'sending' | 'error'>('idle');
  readonly targetedError = signal('');
  readonly targetedResult = signal<SendNotificationResult | null>(null);

  sendBroadcast(): void {
    if (this.broadcastStatus() === 'sending') return;
    const title = this.broadcastTitle.trim();
    const body = this.broadcastBody.trim();
    if (!title || !body) {
      this.broadcastStatus.set('error');
      this.broadcastError.set('Title and body are both required.');
      return;
    }
    if (!confirm('Send this notification to every user with a registered device?')) return;

    this.broadcastStatus.set('sending');
    this.broadcastError.set('');
    this.broadcastResult.set(null);
    this.api.broadcastPush(title, body).subscribe({
      next: (result) => {
        this.broadcastResult.set(result);
        this.broadcastStatus.set('idle');
        this.broadcastTitle = '';
        this.broadcastBody = '';
      },
      error: (e) => {
        this.broadcastStatus.set('error');
        this.broadcastError.set(e?.error?.errors?.[0] ?? 'Broadcast failed. Please try again.');
      },
    });
  }

  searchUsers(): void {
    const term = this.userSearch.trim();
    if (!term) {
      this.userResults.set([]);
      return;
    }
    this.userSearchLoading.set(true);
    this.api.getUsers({ search: term, limit: 10 }).subscribe({
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

  removeSelected(user: UserRow): void {
    this.selectedUsers.set(this.selectedUsers().filter((u) => u.id !== user.id));
  }

  sendTargeted(): void {
    if (this.targetedStatus() === 'sending') return;
    const title = this.targetedTitle.trim();
    const body = this.targetedBody.trim();
    const userIds = this.selectedUsers().map((u) => u.id);
    if (userIds.length === 0) {
      this.targetedStatus.set('error');
      this.targetedError.set('Select at least one user.');
      return;
    }
    if (!title || !body) {
      this.targetedStatus.set('error');
      this.targetedError.set('Title and body are both required.');
      return;
    }
    this.targetedStatus.set('sending');
    this.targetedError.set('');
    this.targetedResult.set(null);
    this.api.sendPushToUsers(userIds, title, body).subscribe({
      next: (result) => {
        this.targetedResult.set(result);
        this.targetedStatus.set('idle');
        this.targetedTitle = '';
        this.targetedBody = '';
        this.selectedUsers.set([]);
      },
      error: (e) => {
        this.targetedStatus.set('error');
        this.targetedError.set(e?.error?.errors?.[0] ?? 'Failed to send the notification.');
      },
    });
  }
}
