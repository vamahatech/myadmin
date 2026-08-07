import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AppEventsSummary, EventBreakdown } from '../../models/app-events.model';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Admin-only in-app usage analytics (structure-only events, no IP/geo — see
 * event-schemas.ts in the backend). Same shape as AnalyticsService: the auth
 * interceptor adds the Bearer token automatically.
 */
@Injectable({ providedIn: 'root' })
export class AppEventsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  summary(appSlug: string, days = 30): Observable<AppEventsSummary> {
    return this.http
      .get<ApiResponse<AppEventsSummary>>(
        `${this.base}/apps/${appSlug}/events/summary?days=${days}`,
      )
      .pipe(map((res) => res.data));
  }

  eventBreakdown(appSlug: string, event: string, days = 30): Observable<EventBreakdown> {
    return this.http
      .get<ApiResponse<EventBreakdown>>(
        `${this.base}/apps/${appSlug}/events/${event}/breakdown?days=${days}`,
      )
      .pipe(map((res) => res.data));
  }
}
