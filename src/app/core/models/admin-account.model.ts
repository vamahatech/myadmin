// Console admin accounts — vamaha-backend /admins and /audit (superadmin only).

import { AppRole } from './permissions.model';

export type AdminRole = 'ADMIN' | 'SUPERADMIN';
export type AdminStatus = 'active' | 'invited' | 'deactivated';

export interface AccessGrant {
  appId: string;
  role: AppRole;
  /** Empty = every module. */
  modules: string[];
}

export interface AdminAccount {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  status: AdminStatus;
  lastLoginAt: string | null;
  invitedAt: string | null;
  createdAt: string;
  access: AccessGrant[];
}

export interface InviteResult {
  admin: AdminAccount;
  emailed: boolean;
  /** Only when the server can't send email (no SMTP): share it yourself. */
  inviteUrl?: string;
}

export interface AuditEntry {
  id: string;
  actorId: string | null;
  actorEmail: string;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditPage {
  entries: AuditEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'admin.invite': 'Invited an admin',
  'admin.invite_resend': 'Resent an invite',
  'admin.update': 'Updated an admin',
  'admin.deactivate': 'Deactivated an admin',
  'admin.reactivate': 'Reactivated an admin',
  'admin.access_update': 'Changed app access',
  'admin.reset_sent': 'Sent a password reset',
  'auth.invite_accepted': 'Accepted invite',
  'auth.password_reset': 'Reset own password',
  'auth.password_changed': 'Changed own password',
  'app_session.issue': 'Opened an app session',
};
