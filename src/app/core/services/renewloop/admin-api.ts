import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { SendNotificationResult, UserDetail, UsersPage, UsersQuery } from '../../models/renewloop/user.model';
import { ActivityPage, ActivityQuery } from '../../models/renewloop/activity.model';

// Typed client for sbmint's /admin/* routes (excluding /admin/auth/login,
// which RenewloopAuthService owns directly). No component talks to
// HttpClient directly for RenewLoop data.
@Injectable({ providedIn: 'root' })
export class RenewloopAdminApi {
  private http = inject(HttpClient);
  private base = environment.renewloop.apiBaseUrl;

  getUsers(query: UsersQuery = {}): Observable<UsersPage> {
    let params = new HttpParams();
    if (query.search) params = params.set('search', query.search);
    if (query.sortBy) params = params.set('sortBy', query.sortBy);
    if (query.sortDir) params = params.set('sortDir', query.sortDir);
    if (query.hasActiveSubscription !== undefined) {
      params = params.set('hasActiveSubscription', String(query.hasActiveSubscription));
    }
    params = params.set('page', String(query.page ?? 1)).set('limit', String(query.limit ?? 20));
    return this.http.get<UsersPage>(`${this.base}/admin/users`, { params });
  }

  getUser(id: string): Observable<UserDetail> {
    return this.http
      .get<{ user: UserDetail }>(`${this.base}/admin/users/${encodeURIComponent(id)}`)
      .pipe(map((r) => r.user));
  }

  getActivity(query: ActivityQuery = {}): Observable<ActivityPage> {
    let params = new HttpParams();
    for (const key of ['userId', 'event', 'from', 'to'] as const) {
      const v = query[key];
      if (v) params = params.set(key, v);
    }
    params = params.set('page', String(query.page ?? 1)).set('limit', String(query.limit ?? 20));
    return this.http.get<ActivityPage>(`${this.base}/admin/activity`, { params });
  }

  broadcastPush(title: string, body: string): Observable<SendNotificationResult> {
    return this.http.post<SendNotificationResult>(`${this.base}/admin/notifications/send`, {
      title,
      body,
      target: 'all',
    });
  }

  sendPushToUsers(userIds: string[], title: string, body: string): Observable<SendNotificationResult> {
    return this.http.post<SendNotificationResult>(`${this.base}/admin/notifications/send`, {
      title,
      body,
      target: 'users',
      userIds,
    });
  }
}
