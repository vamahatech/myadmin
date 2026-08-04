// Crowdsourced product submission — shapes for /admin/submissions.

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

// A label photo the parent submitted. `url` is a short-lived pre-signed S3 GET
// URL minted by the backend on read (it expires ~15 min).
export interface SubmissionImage {
  kind: 'ingredients' | 'front' | 'back' | 'barcode' | 'nutrition';
  url: string;
}

export interface Submission {
  id: string;
  barcode: string | null;
  name: string | null;
  brand: string | null;
  weight: string | null;
  category: string | null;
  ingredients: string | null;
  note: string | null;
  status: SubmissionStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  submitter_email: string | null;
  images?: SubmissionImage[];
}

export interface SubmissionList {
  rows: Submission[];
  counts: { pending: number; approved: number; rejected: number };
}
