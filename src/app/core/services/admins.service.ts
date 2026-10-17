import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AccessGrant, AdminAccount, AdminRole, AuditPage, InviteResult,
} from '../models/admin-account.model';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/** Superadmin-only admin management against vamaha-backend (/admins, /audit). */
@Injectable({ providedIn: 'root' })
export class AdminsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  list(): Observable<AdminAccount[]> {
    return this.http.get<ApiResponse<AdminAccount[]>>(`${this.base}/admins`).pipe(map((r) => r.data));
  }

  invite(body: { name: string; email: string; role: AdminRole; access: AccessGrant[] }): Observable<InviteResult> {
    return this.http.post<ApiResponse<InviteResult>>(`${this.base}/admins`, body).pipe(map((r) => r.data));
  }

  update(id: string, body: { name?: string; role?: AdminRole; isActive?: boolean }): Observable<AdminAccount> {
    return this.http.patch<ApiResponse<AdminAccount>>(`${this.base}/admins/${id}`, body).pipe(map((r) => r.data));
  }

  setAccess(id: string, access: AccessGrant[]): Observable<AdminAccount> {
    return this.http
      .put<ApiResponse<AdminAccount>>(`${this.base}/admins/${id}/access`, { access })
      .pipe(map((r) => r.data));
  }

  resendInvite(id: string): Observable<{ emailed: boolean; inviteUrl?: string }> {
    return this.http
      .post<ApiResponse<{ emailed: boolean; inviteUrl?: string }>>(`${this.base}/admins/${id}/resend-invite`, {})
      .pipe(map((r) => r.data));
  }

  sendReset(id: string): Observable<{ emailed: boolean }> {
    return this.http
      .post<ApiResponse<{ emailed: boolean }>>(`${this.base}/admins/${id}/send-reset`, {})
      .pipe(map((r) => r.data));
  }

  audit(q: { action?: string; actorId?: string; page?: number; limit?: number }): Observable<AuditPage> {
    let params = new HttpParams().set('page', String(q.page ?? 1)).set('limit', String(q.limit ?? 20));
    if (q.action) params = params.set('action', q.action);
    if (q.actorId) params = params.set('actorId', q.actorId);
    return this.http.get<ApiResponse<AuditPage>>(`${this.base}/audit`, { params }).pipe(map((r) => r.data));
  }
}
