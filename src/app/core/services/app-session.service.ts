import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { VerdiqAuthService } from './verdiq/verdiq-auth';
import { RenewloopAuthService } from './renewloop/renewloop-auth';
import type { AdminUser } from '../models/verdiq/user.model';

interface BrokeredSession {
  token: string;
  expiresAt: string;
  user?: Partial<AdminUser>;
}

/**
 * Sessions for apps whose backend differs from vamaha-backend (Verdiq, RenewLoop).
 * vamaha-backend's session broker (POST /app-sessions/:appId) holds those backends'
 * service credentials and only issues a session to admins with access to the app,
 * so no password ships in this bundle. Each app's auth service keeps the token in
 * its own storage; this only fetches one when none is valid yet.
 */
@Injectable({ providedIn: 'root' })
export class AppSessionService {
  private readonly http = inject(HttpClient);
  private readonly verdiqAuth = inject(VerdiqAuthService);
  private readonly renewloopAuth = inject(RenewloopAuthService);

  async ensureVerdiqSession(): Promise<void> {
    if (this.verdiqAuth.getToken() && !this.verdiqAuth.isTokenExpired()) return;
    const session = await this.broker('verdiq');
    this.verdiqAuth.adoptSession(session.token, session.user);
  }

  async ensureRenewloopSession(): Promise<void> {
    if (this.renewloopAuth.getToken() && !this.renewloopAuth.isTokenExpired()) return;
    const session = await this.broker('renewloop');
    this.renewloopAuth.adoptSession(session.token);
  }

  /** Clears every app session. Called from AuthService on sign-out and on a new sign-in,
   * so a different admin on this browser never inherits the previous one's sessions.
   * (Keeps its historical name; it clears both.) */
  clearVerdiqSession(): void {
    this.verdiqAuth.logout();
    this.renewloopAuth.logout();
  }

  private broker(appId: 'verdiq' | 'renewloop'): Promise<BrokeredSession> {
    return firstValueFrom(
      this.http
        .post<{ data: BrokeredSession }>(`${environment.apiBaseUrl}/app-sessions/${appId}`, {})
        .pipe(map((res) => res.data)),
    );
  }
}
