/** One event name's count, as returned in GET /apps/:appSlug/events/summary's byEvent array. */
export interface AppEventCount {
  event: string;
  count: number;
}

/** The previous, equal-length period — same shape minus the breakdowns nobody diffs. */
export interface AppEventsPreviousSummary {
  totalEvents: number;
  uniqueInstalls: number;
  byEvent: AppEventCount[];
}

/**
 * Response shape of GET /apps/:appSlug/events/summary (admin, Bearer-gated).
 * `previous` is the immediately preceding period of the same length —
 * yesterday when rangeDays is 1 (calendar-day), otherwise a rolling window
 * (e.g. the 7 days before the current 7).
 */
export interface AppEventsSummary {
  appSlug: string;
  rangeDays: number;
  totalEvents: number;
  uniqueInstalls: number;
  byEvent: AppEventCount[];
  byAppVersion: { appVersion: string | null; count: number }[];
  byOsMajor: { osMajor: string | null; count: number }[];
  previous: AppEventsPreviousSummary;
}

/** One day's bucket within GET /apps/:appSlug/events/timeseries's points array. */
export interface AppEventsTimeseriesPoint {
  date: string; // YYYY-MM-DD
  totalEvents: number;
  uniqueInstalls: number;
}

/** Response shape of GET /apps/:appSlug/events/timeseries (admin, Bearer-gated). */
export interface AppEventsTimeseries {
  appSlug: string;
  points: AppEventsTimeseriesPoint[];
}

/** One prop value's count within an event breakdown. */
export interface PropValueCount {
  value: string;
  count: number;
}

/** Response shape of GET /apps/:appSlug/events/:event/breakdown (admin, Bearer-gated). */
export interface EventBreakdown {
  appSlug: string;
  event: string;
  rangeDays: number;
  totalEvents: number;
  byProp: Record<string, PropValueCount[]>;
}
