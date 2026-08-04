// Shape of GET /admin/analytics — scan activity over a window.

export interface AnalyticsTotals {
  total: number;
  cacheHits: number;
  cacheHitRate: number;
  unfound: number;
}

export interface DayPoint {
  day: string;
  scans: number;
  hits: number;
}

export interface VerdictCount {
  verdict: string;
  count: number;
}

export interface TopScan {
  barcode: string;
  scans: number;
  product_name: string | null;
}

export interface UnfoundScan {
  barcode: string;
  scans: number;
}

export interface Analytics {
  days: number;
  totals: AnalyticsTotals;
  perDay: DayPoint[];
  verdictMix: VerdictCount[];
  topScanned: TopScan[];
  unfound: UnfoundScan[];
}
