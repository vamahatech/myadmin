// RenewLoop end users — shapes for sbmint's /admin/* routes.
// Matches the already-shipped backend exactly (see sbmint
// backend/src/modules/admin and backend/src/modules/admin-auth) — this is
// not aspirational, every field here is returned today.

export interface UserRow {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  activeSubscriptionCount: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UsersPage {
  users: UserRow[];
  pagination: Pagination;
}

export type SortBy = 'createdAt' | 'name';
export type SortDir = 'asc' | 'desc';

export interface UsersQuery {
  search?: string;
  sortBy?: SortBy;
  sortDir?: SortDir;
  hasActiveSubscription?: boolean;
  page?: number;
  limit?: number;
}

export interface Credentials {
  email: string;
  password: string;
}

// sbmint's POST /admin/auth/login returns a bare token — no user object.
export interface LoginResponse {
  token: string;
}

// The admin JWT payload carries only { sub: 'admin', role: 'admin' } — no
// email — so the session's email comes from what the operator typed at
// login, not from the server.
export interface AdminSession {
  email: string | null;
}

export interface SendNotificationResult {
  successCount: number;
  failureCount: number;
}
