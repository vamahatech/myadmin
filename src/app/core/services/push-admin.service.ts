import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  BroadcastResult,
  CredentialStatus,
  PushCronRunRow,
  PushTokenRow,
} from '../../models/push-admin.model';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Admin-only push-notification operations for the retention-push feature.
 * The auth interceptor adds the Bearer token automatically, errors surface
 * to the caller instead of being swallowed.
 */
@Injectable({ providedIn: 'root' })
export class PushAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}`;

  /** Hardcoded for now — a real apps registry UI is out of scope until a 2nd app ships push. */
  listApps(): string[] {
    return ['emi-planner'];
  }

  getCredentialStatus(): Observable<CredentialStatus> {
    return this.http
      .get<ApiResponse<CredentialStatus>>(`${this.base}/push/credential-status`)
      .pipe(map((res) => res.data));
  }

  listTokens(appSlug: string): Observable<PushTokenRow[]> {
    return this.http
      .get<ApiResponse<PushTokenRow[]>>(`${this.base}/apps/${appSlug}/push/tokens`)
      .pipe(map((res) => res.data ?? []));
  }

  broadcast(appSlug: string, body: { title: string; body: string }): Observable<BroadcastResult> {
    return this.http
      .post<ApiResponse<BroadcastResult>>(`${this.base}/apps/${appSlug}/push/broadcast`, body)
      .pipe(map((res) => res.data));
  }

  getCronRuns(appSlug: string): Observable<PushCronRunRow[]> {
    return this.http
      .get<ApiResponse<PushCronRunRow[]>>(`${this.base}/apps/${appSlug}/push/cron-runs`)
      .pipe(map((res) => res.data ?? []));
  }

  runCronNow(appSlug: string): Observable<BroadcastResult> {
    return this.http
      .post<ApiResponse<BroadcastResult>>(`${this.base}/apps/${appSlug}/push/run-cron-now`, {})
      .pipe(map((res) => res.data));
  }
}
