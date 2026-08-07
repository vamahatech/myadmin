/** One event name's count, as returned in GET /apps/:appSlug/events/summary's byEvent array. */
export interface AppEventCount {
  event: string;
  count: number;
}

/** Response shape of GET /apps/:appSlug/events/summary (admin, Bearer-gated). */
export interface AppEventsSummary {
  appSlug: string;
  rangeDays: number;
  totalEvents: number;
  uniqueInstalls: number;
  byEvent: AppEventCount[];
  byAppVersion: { appVersion: string | null; count: number }[];
  byOsMajor: { osMajor: string | null; count: number }[];
}
