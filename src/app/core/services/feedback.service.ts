import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { FeedbackPage, FeedbackRow, FeedbackStatus } from '../../models/feedback.model';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Admin-only feedback operations against the main vamaha-backend /feedback
 * endpoint (not to be confused with Verdiq's separate feedback backend).
 */
@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  findAll(params: { app?: string; status?: FeedbackStatus; page?: number; limit?: number }): Observable<FeedbackPage> {
    const query = new URLSearchParams();
    if (params.app) query.set('app', params.app);
    if (params.status) query.set('status', params.status);
    query.set('page', String(params.page ?? 1));
    query.set('limit', String(params.limit ?? 20));

    return this.http
      .get<ApiResponse<FeedbackPage>>(`${this.base}/feedback?${query.toString()}`)
      .pipe(map((res) => res.data));
  }

  updateStatus(id: string, status: FeedbackStatus): Observable<FeedbackRow> {
    return this.http
      .patch<ApiResponse<FeedbackRow>>(`${this.base}/feedback/${id}/status`, { status })
      .pipe(map((res) => res.data));
  }
}
