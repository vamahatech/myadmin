import { Injectable, computed, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AppSessionService } from './app-session.service';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
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

  readonly token = signal<string | null>(this.readToken());
  readonly user = signal<AuthUser | null>(null);
  readonly isLoggedIn = computed(() => !!this.token());

  /** Authenticate, store the token, and load the current user. */
  async login(email: string, password: string): Promise<AuthUser> {
    const { accessToken } = await firstValueFrom(
      this.http
        .post<ApiResponse<{ accessToken: string }>>(`${this.base}/login`, {
          email,
          password,
        })
        .pipe(map((res) => res.data)),
    );
    this.setToken(accessToken);
    return this.loadUser();
  }

  /** Fetch the authenticated user (also validates the stored token). */
  async loadUser(): Promise<AuthUser> {
    const user = await firstValueFrom(
      this.http
        .get<ApiResponse<AuthUser>>(`${this.base}/me`)
        .pipe(map((res) => res.data)),
    );
    this.user.set(user);
    return user;
  }

  logout(): void {
    this.setToken(null);
    this.user.set(null);
    this.appSession.clearVerdiqSession();
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
