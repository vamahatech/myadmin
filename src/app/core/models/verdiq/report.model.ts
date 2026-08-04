// Product data-accuracy reports — shapes for /admin/reports.

export type ReportStatus = 'pending' | 'approved' | 'rejected';
export type ReportReason = 'wrong_ingredients' | 'wrong_verdict' | 'wrong_info' | 'other';

export interface ProductReport {
  id: string;
  barcode: string;
  reason: ReportReason;
  note: string | null;
  status: ReportStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  reporter_email: string | null;
  product_name: string | null;
}

export interface ProductReportList {
  rows: ProductReport[];
  counts: { pending: number; approved: number; rejected: number };
}
