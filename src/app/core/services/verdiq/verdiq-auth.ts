import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { StorageService } from './storage';
import { AdminUser, Credentials, LoginResponse } from '../../models/verdiq/user.model';

// Decodes the payload of a JWT without verifying it (verification is the
// server's job). We only read it to know is_admin/email for the UI + guards.
function decodeJwt(token: string): { sub: string; email: string; is_admin?: boolean } | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class VerdiqAuthService {
  private http = inject(HttpClient);
  private storage = inject(StorageService);
  private base = environment.verdiq.apiBaseUrl;

  // Reactive user state, hydrated from any stored token on construction.
  private readonly userSig = signal<AdminUser | null>(this.userFromStoredToken());
  readonly user = this.userSig.asReadonly();
  readonly isAuthenticated = computed(() => this.userSig() !== null);
  readonly isAdmin = computed(() => this.userSig()?.is_admin === true);

  login(creds: Credentials): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/auth/login`, creds).pipe(
      tap((res) => {
        this.storage.setToken(res.token);
        const claims = decodeJwt(res.token);
        this.userSig.set({
          id: res.user.id,
          email: res.user.email,
          is_admin: claims?.is_admin ?? res.user.is_admin,
        });
      }),
    );
  }

  /** Stores a session issued by the vamaha-backend broker (POST /app-sessions/verdiq). */
  adoptSession(token: string, user?: Partial<AdminUser>): void {
    this.storage.setToken(token);
    const claims = decodeJwt(token);
    this.userSig.set({
      id: user?.id ?? claims?.sub ?? '',
      email: user?.email ?? claims?.email ?? '',
      is_admin: claims?.is_admin ?? user?.is_admin ?? false,
    });
  }

  logout(): void {
    this.storage.clearToken();
    this.userSig.set(null);
  }

  getToken(): string | null {
    return this.storage.getToken();
  }

  /**
   * Whether the currently stored token is expired (or unreadable). Used by
   * AppSessionService to decide whether a truthy-but-dead token still needs
   * a fresh silent login.
   */
  /** True when there is no token, it can't be read, or it expires within `marginMs`. */
  isTokenExpired(marginMs = 0): boolean {
    const token = this.storage.getToken();
    if (!token) return true;
    const claims = decodeJwt(token) as { exp?: number } | null;
    if (!claims || typeof claims.exp !== 'number') return true;
    return claims.exp * 1000 - marginMs <= Date.now();
  }

  private userFromStoredToken(): AdminUser | null {
    const token = this.storage.getToken();
    if (!token) return null;
    const claims = decodeJwt(token);
    if (!claims) return null;
    return { id: claims.sub, email: claims.email, is_admin: claims.is_admin };
  }
}
