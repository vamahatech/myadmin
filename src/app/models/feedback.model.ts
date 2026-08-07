export type FeedbackStatus = 'NEW' | 'READ' | 'ARCHIVED';

/** One feedback/contact submission, as returned by GET /feedback (admin). */
export interface FeedbackRow {
  id: string;
  name: string | null;
  email: string | null;
  message: string;
  rating: number | null;
  source: string | null;
  app: string | null;
  platform: string | null;
  appVersion: string | null;
  type: string | null;
  status: FeedbackStatus;
  createdAt: string;
}

/** Response shape of GET /feedback (paginated). */
export interface FeedbackPage {
  items: FeedbackRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}
