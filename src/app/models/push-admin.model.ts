/** One registered device, as returned by GET /apps/:appSlug/push/tokens (admin). */
export interface PushTokenRow {
  installId: string;
  platform: string;
  createdAt: string;
  lastDormancyPushAt: string | null;
}

/** One dormancy-cron execution, as returned by GET /apps/:appSlug/push/cron-runs (admin). */
export interface PushCronRunRow {
  id: string;
  appSlug: string;
  ranAt: string;
  candidates: number;
  sent: number;
  staleRemoved: number;
}

/** Result of POST /apps/:appSlug/push/broadcast or run-cron-now. */
export interface BroadcastResult {
  sent: number;
  failed?: number;
  staleRemoved: number;
  total?: number;
  candidates?: number;
}

export interface CredentialStatus {
  configured: boolean;
}
