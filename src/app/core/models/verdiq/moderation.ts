// Shared bits for Verdiq's moderation queues (submissions, reports, ingest).

export type ModerationStatus = 'pending' | 'approved' | 'rejected';

export const MODERATION_STATUS_LABELS: Record<ModerationStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

/** Badge class for a moderation status. */
export function moderationTone(status: string): string {
  switch (status) {
    case 'pending':
    case 'pending_review':
    case 'new':
      return 'badge-warning';
    case 'approved':
    case 'read':
      return 'badge-success';
    case 'rejected':
      return 'badge-danger';
    default:
      return 'badge-neutral';
  }
}
