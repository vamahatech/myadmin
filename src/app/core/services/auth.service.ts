import { Injectable, computed, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AppSessionService } from './app-session.service';
import { Permissions } from '../models/permissions.model';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  /** From GET /auth/me: which apps/modules this admin may use (server-enforced). */
  permissions: Permissions;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface SessionResponse {
  accessToken: string;
}

const TOKEN_KEY = 'vamaha_admin_token';

/**
 * Client-side admin auth. Talks to the backend /auth API, persists the JWT in
 * localStorage, and exposes reactive `token` / `user` signals.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly base = `${environment.apiBaseUrl}/auth`;
  private readonly appSession = inject(AppSessionService);
  private loading: Promise<AuthUser> | null = null;

  readonly token = signal<string | null>(this.readToken());
  readonly user = signal<AuthUser | null>(null);
  readonly isLoggedIn = computed(() => !!this.token());

  /** Authenticate, store the token, and load the current user. */
  async login(email: string, password: string): Promise<AuthUser> {
    return this.startSession(
      this.http.post<ApiResponse<SessionResponse>>(`${this.base}/login`, { email, password }),
    );
  }

  /** Fetch the authenticated user (also validates the stored token). */
  async loadUser(): Promise<AuthUser> {
    // Shell, guards and pages may all ask at once on first load: share one request.
    this.loading ??= firstValueFrom(
      this.http.get<ApiResponse<AuthUser>>(`${this.base}/me`).pipe(map((res) => res.data)),
    )
      .then((user) => {
        this.user.set(user);
        return user;
      })
      .finally(() => (this.loading = null));
    return this.loading;
  }

  /** The current user, loading it once if needed. Null when signed out or the token is dead. */
  async ensureUser(): Promise<AuthUser | null> {
    if (!this.token()) return null;
    if (this.user()) return this.user();
    try {
      return await this.loadUser();
    } catch {
      this.logout();
      return null;
    }
  }

  /** Always resolves the same way whether or not the account exists. */
  async forgotPassword(email: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.base}/forgot-password`, { email }));
  }

  /** Set a new password from an emailed reset link; signs in. */
  resetPassword(token: string, password: string): Promise<AuthUser> {
    return this.startSession(
      this.http.post<ApiResponse<SessionResponse>>(`${this.base}/reset-password`, { token, password }),
    );
  }

  /** Set the first password from an invite link; signs in. */
  acceptInvite(token: string, password: string): Promise<AuthUser> {
    return this.startSession(
      this.http.post<ApiResponse<SessionResponse>>(`${this.base}/accept-invite`, { token, password }),
    );
  }

  /** Other sessions are signed out by the server; this one continues with the fresh token. */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const { accessToken } = await firstValueFrom(
      this.http
        .post<ApiResponse<SessionResponse>>(`${this.base}/change-password`, {
          currentPassword,
          newPassword,
        })
        .pipe(map((res) => res.data)),
    );
    this.setToken(accessToken);
  }

  logout(): void {
    this.setToken(null);
    this.user.set(null);
    this.appSession.clearVerdiqSession();
  }

  private async startSession(request: Observable<ApiResponse<SessionResponse>>): Promise<AuthUser> {
    const { accessToken } = await firstValueFrom(request.pipe(map((res) => res.data)));
    // A different admin may have signed in on this browser: drop their app sessions.
    this.appSession.clearVerdiqSession();
    this.user.set(null);
    this.setToken(accessToken);
    return this.loadUser();
  }

  private readToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  private setToken(value: string | null): void {
    this.token.set(value);
    if (!this.isBrowser) return;
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  }
}
