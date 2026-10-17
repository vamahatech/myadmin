import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { StorageService } from './storage';
import { AdminSession, Credentials, LoginResponse } from '../../models/renewloop/user.model';

// Decodes the payload of a JWT without verifying it (verification is the
// server's job). We only read it to know role/exp for the guard + expiry
// check — sbmint's admin token has no email claim, unlike Verdiq's.
function decodeJwt(token: string): { sub?: string; role?: string; exp?: number } | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// sbmint's POST /admin/auth/login returns a bare { token } — no user
// object, unlike Verdiq's { user, token } shape — so the session's display
// email comes from the submitted credentials, not from the response. A page
// refresh keeps the session valid (token still verifies role: 'admin') but
// loses the display email until the next login.
@Injectable({ providedIn: 'root' })
export class RenewloopAuthService {
  private http = inject(HttpClient);
  private storage = inject(StorageService);
  private base = environment.renewloop.apiBaseUrl;

  private readonly sessionSig = signal<AdminSession | null>(this.sessionFromStoredToken());
  readonly session = this.sessionSig.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionSig() !== null);

  login(creds: Credentials): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/admin/auth/login`, creds).pipe(
      tap((res) => {
        this.storage.setToken(res.token);
        this.sessionSig.set({ email: creds.email });
      }),
    );
  }

  /** Stores a session issued by the vamaha-backend broker (POST /app-sessions/renewloop). */
  adoptSession(token: string): void {
    this.storage.setToken(token);
    this.sessionSig.set({ email: null });
  }

  logout(): void {
    this.storage.clearToken();
    this.sessionSig.set(null);
  }

  getToken(): string | null {
    return this.storage.getToken();
  }

  /** True when there is no token, it can't be read, or it expires within `marginMs`. */
  isTokenExpired(marginMs = 0): boolean {
    const token = this.storage.getToken();
    if (!token) return true;
    const claims = decodeJwt(token);
    if (!claims || typeof claims.exp !== 'number') return true;
    return claims.exp * 1000 - marginMs <= Date.now();
  }

  private sessionFromStoredToken(): AdminSession | null {
    const token = this.storage.getToken();
    if (!token) return null;
    const claims = decodeJwt(token);
    if (!claims || claims.role !== 'admin') return null;
    return { email: null };
  }
}
