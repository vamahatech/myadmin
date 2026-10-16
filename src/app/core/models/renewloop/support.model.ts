// RenewLoop feedback and error issues — GET/PATCH /admin/feedback and
// /admin/errors on sbmint. Mirrors the backend response exactly.

import { Pagination } from './user.model';

export type FeedbackStatus = 'new' | 'investigating' | 'resolved' | 'closed';
export type FeedbackCategory = 'bug' | 'suggestion' | 'complaint' | 'question' | 'other';

export interface FeedbackItem {
  id: string;
  /** null when the account was deleted since. */
  user: { id: string; name: string; email: string } | null;
  category: FeedbackCategory;
  message: string;
  appVersion: string | null;
  platform: string | null;
  osVersion: string | null;
  device: string | null;
  status: FeedbackStatus;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackPage {
  feedback: FeedbackItem[];
  counts: Record<FeedbackStatus, number>;
  pagination: Pagination;
}

export interface FeedbackQuery {
  status?: FeedbackStatus | 'open';
  category?: FeedbackCategory;
  page?: number;
  limit?: number;
}

export type ErrorStatus = 'new' | 'investigating' | 'resolved' | 'ignored';
export type ErrorSource = 'client' | 'server';
export type ErrorKind = 'uncaught' | 'handled' | 'api_failure';

export interface ErrorIssue {
  id: string;
  source: ErrorSource;
  kind: ErrorKind;
  name: string | null;
  message: string | null;
  stack: string | null;
  /** Screen route (JS errors) or "METHOD /path" (failed requests). */
  route: string | null;
  httpStatus: number | null;
  count: number;
  affectedUsers: number;
  affectedUsersCapped: boolean;
  appVersions: string[];
  platforms: string[];
  status: ErrorStatus;
  /** Was resolved, then happened again. */
  regressed: boolean;
  note: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface ErrorsPage {
  errors: ErrorIssue[];
  counts: Record<ErrorStatus, number> & { newLast24h: number };
  pagination: Pagination;
}

export interface ErrorsQuery {
  status?: ErrorStatus | 'open';
  source?: ErrorSource;
  kind?: ErrorKind;
  page?: number;
  limit?: number;
}

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: 'Bug',
  suggestion: 'Suggestion',
  complaint: 'Complaint',
  question: 'Question',
  other: 'Other',
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'New',
  investigating: 'Investigating',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const ERROR_STATUS_LABELS: Record<ErrorStatus, string> = {
  new: 'New',
  investigating: 'Investigating',
  resolved: 'Resolved',
  ignored: 'Ignored',
};

export const ERROR_KIND_LABELS: Record<ErrorKind, string> = {
  uncaught: 'App error',
  handled: 'Handled error',
  api_failure: 'Failed request',
};

/** Badge tone per status, shared by both pages. */
export function statusTone(status: FeedbackStatus | ErrorStatus): string {
  switch (status) {
    case 'new':
      return 'badge-danger';
    case 'investigating':
      return 'badge-warning';
    case 'resolved':
      return 'badge-success';
    default:
      return 'badge-neutral';
  }
}
