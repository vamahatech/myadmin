// RenewLoop activity log — GET /admin/activity (sbmint analytics_events,
// restricted to account/subscription/admin actions).

import { Pagination } from './user.model';

export type ActivityEvent =
  | 'user_registered'
  | 'user_logged_in'
  | 'password_changed'
  | 'profile_updated'
  | 'subscription_created'
  | 'subscription_edited'
  | 'subscription_deleted'
  | 'subscription_status_changed'
  | 'reminder_enabled'
  | 'notification_permission_granted'
  | 'notification_permission_denied'
  | 'admin_notification_sent';

export interface ActivityEntry {
  id: string;
  event: ActivityEvent;
  /** null for admin actions, and for accounts deleted since (deletedUser). */
  user: { id: string; name: string; email: string } | null;
  deletedUser: boolean;
  /** e.g. "Chrome on Windows"; only on sign-in/account events. */
  device: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface ActivityPage {
  activity: ActivityEntry[];
  pagination: Pagination;
}

export interface ActivityQuery {
  userId?: string;
  event?: ActivityEvent;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export const ACTIVITY_LABELS: Record<ActivityEvent, string> = {
  user_registered: 'Signed up',
  user_logged_in: 'Signed in',
  password_changed: 'Changed password',
  profile_updated: 'Updated profile',
  subscription_created: 'Added subscription',
  subscription_edited: 'Edited subscription',
  subscription_deleted: 'Deleted subscription',
  subscription_status_changed: 'Changed subscription status',
  reminder_enabled: 'Turned on a reminder',
  notification_permission_granted: 'Allowed notifications',
  notification_permission_denied: 'Blocked notifications',
  admin_notification_sent: 'Admin sent a notification',
};

/** Short secondary text for an entry ("via reset", "“Title” · all users · push"). */
export function activityDetail(e: ActivityEntry): string {
  const d = e.details;
  switch (e.event) {
    case 'password_changed':
      return d['via'] === 'reset' ? 'via password reset' : '';
    case 'subscription_status_changed':
      return typeof d['status'] === 'string' ? `now ${d['status']}` : '';
    case 'admin_notification_sent': {
      const who = d['target'] === 'all' ? 'all users' : `${d['recipientCount'] ?? 0} user${d['recipientCount'] === 1 ? '' : 's'}`;
      const channels = Array.isArray(d['channels']) ? (d['channels'] as string[]).join(' + ') : 'push';
      return `“${d['title'] ?? ''}” · ${who} · ${channels}`;
    }
    default:
      return '';
  }
}
