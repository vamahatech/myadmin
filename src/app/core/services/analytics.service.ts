import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AnalyticsSummary } from '../../models/analytics.model';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Admin-only analytics operations. Same shape as AdminContentService: the
 * auth interceptor adds the Bearer token automatically, errors surface to
 * the caller instead of being swallowed.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  summary(days = 30): Observable<AnalyticsSummary> {
    return this.http
      .get<ApiResponse<AnalyticsSummary>>(`${this.base}/analytics/summary?days=${days}`)
      .pipe(map((res) => res.data));
  }
}
