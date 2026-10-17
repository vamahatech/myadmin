// Search + paging for lists the backend returns whole (e.g. Verdiq's moderation
// queues, capped at 200 rows server-side). Prefer server paging when the endpoint has it.

/** True when every word of `query` appears in at least one of the fields (case-insensitive). */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = fields.filter(Boolean).join(' ').toLowerCase();
  return words.every((w) => haystack.includes(w));
}

/** Rows for a 1-based page. */
export function pageOf<T>(rows: readonly T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

/** Display name for someone we only know by email: the part before the @. */
export function emailName(email: string | null | undefined): string {
  return email ? email.split('@')[0] : '';
}
