// Shapes for GET /admin/verdicts — the review queue.

export type VerdictLevel = 'OK' | 'Caution' | 'Avoid';

export interface DecodedAdditive {
  ins: string;
  name: string;
  risk: string;
  controversial: boolean;
}

export interface VerdictRow {
  barcode: string;
  age_band: string;
  verdict: VerdictLevel;
  reason: string;
  citation: string;
  flags: string[];
  additives: DecodedAdditive[];
  updated_at: string;
  product_name: string | null;
  product_brand: string | null;
  stale_days: number;
}

export interface VerdictPage {
  page: number;
  pageSize: number;
  total: number;
  rows: VerdictRow[];
}
