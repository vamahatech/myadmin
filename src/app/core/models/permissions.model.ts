// Admin permissions as returned by vamaha-backend GET /auth/me (`permissions`).
// The server enforces them; the console uses them to hide what would be refused.
// Mirrors vamaha-backend src/common/permissions.ts — keep the two in sync.

export type AppRole = 'VIEWER' | 'EDITOR' | 'MANAGER';
export type PermissionLevel = 'view' | 'edit' | 'manage';

export interface AppGrant {
  role: AppRole;
  /** Empty = every module of the app. */
  modules: string[];
}

export interface Permissions {
  superadmin: boolean;
  /** Only apps the admin can open (every app for a superadmin). */
  apps: Record<string, AppGrant>;
  /** Every app's module ids (from the server), for the access editor. */
  catalog: Record<string, string[]>;
}

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  VIEWER: 'Viewer',
  EDITOR: 'Editor',
  MANAGER: 'Manager',
};

export const APP_ROLE_HINTS: Record<AppRole, string> = {
  VIEWER: 'Can look at everything in the app, change nothing.',
  EDITOR: 'Can also create, edit and triage (articles, feedback, errors, moderation).',
  MANAGER: 'Can also send notifications, delete and export.',
};

const ROLE_RANK: Record<AppRole, number> = { VIEWER: 1, EDITOR: 2, MANAGER: 3 };
const LEVEL_RANK: Record<PermissionLevel, number> = { view: 1, edit: 2, manage: 3 };

export function allows(
  perms: Permissions | null | undefined,
  appId: string,
  module: string | null,
  level: PermissionLevel,
): boolean {
  if (!perms) return false;
  if (perms.superadmin) return true;
  const grant = perms.apps[appId];
  if (!grant) return false;
  if (module && grant.modules.length > 0 && !grant.modules.includes(module)) return false;
  return ROLE_RANK[grant.role] >= LEVEL_RANK[level];
}
