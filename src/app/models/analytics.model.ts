/** One app's event count, as returned in GET /analytics/summary's byApp array. */
export interface AnalyticsByApp {
  appSlug: string | null;
  count: number;
}

/** Response shape of GET /analytics/summary (admin, Bearer-gated). */
export interface AnalyticsSummary {
  rangeDays: number;
  totalEvents: number;
  uniqueVisitors: number;
  feedbackInRange: number;
  byType: { type: string; count: number }[];
  byApp: AnalyticsByApp[];
  byCountry: { countryCode: string | null; count: number }[];
  byDevice: { deviceType: string | null; count: number }[];
  byBrowser: { browser: string | null; count: number }[];
  byReferrerHost: { referrerHost: string | null; count: number }[];
}
