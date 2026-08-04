// General app feedback — shapes for /admin/feedback.

export type FeedbackStatus = 'new' | 'read';

export interface AppFeedback {
  id: string;
  note: string;
  status: FeedbackStatus;
  created_at: string;
  sender_email: string | null;
}

export interface AppFeedbackList {
  rows: AppFeedback[];
  counts: { new: number; read: number };
}
