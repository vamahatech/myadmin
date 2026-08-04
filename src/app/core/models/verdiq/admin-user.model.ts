// Users & testers — shapes for /admin/users.

export interface UserRow {
  id: string;
  email: string;
  is_admin: boolean;
  tester_opted_in: boolean;
  last_seen_at: string | null;
  created_at: string;
  children: number;
  inactive_tester: boolean;
}

export interface UsersReport {
  rows: UserRow[];
  ageBands: { under_2: number; '2_to_5': number };
  summary: {
    total_users: number;
    testers: number;
    inactive_testers: number;
    admins: number;
  };
}
