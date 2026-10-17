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

type BrokeredApp = 'verdiq' | 'renewloop';

/** Fetch a new app token this long before the current one expires. */
const REFRESH_MARGIN_MS = 60_000;

/**
 * Sessions for apps whose backend differs from vamaha-backend (Verdiq, RenewLoop),
 * issued by vamaha-backend's session broker (POST /app-sessions/:appId) only to
 * admins with access to the app. With signed sessions the token names this admin
 * and lasts ~15 minutes, so the app interceptors call ensure*Session() before each
 * request (cheap while the token is fresh) and once more on a 401.
 */
@Injectable({ providedIn: 'root' })
export class AppSessionService {
  private readonly http = inject(HttpClient);
  private readonly verdiqAuth = inject(VerdiqAuthService);
  private readonly renewloopAuth = inject(RenewloopAuthService);
  /** Parallel requests share one broker call per app. */
  private readonly inflight = new Map<BrokeredApp, Promise<void>>();

  ensureVerdiqSession(force = false): Promise<void> {
    if (!force && !this.verdiqAuth.isTokenExpired(REFRESH_MARGIN_MS)) return Promise.resolve();
    return this.once('verdiq', async () => {
      const session = await this.broker('verdiq');
      this.verdiqAuth.adoptSession(session.token, session.user);
    });
  }

  ensureRenewloopSession(force = false): Promise<void> {
    if (!force && !this.renewloopAuth.isTokenExpired(REFRESH_MARGIN_MS)) return Promise.resolve();
    return this.once('renewloop', async () => {
      const session = await this.broker('renewloop');
      this.renewloopAuth.adoptSession(session.token);
    });
  }

  /** Clears every app session. Called from AuthService on sign-out and on a new sign-in,
   * so a different admin on this browser never inherits the previous one's sessions.
   * (Keeps its historical name; it clears both.) */
  clearVerdiqSession(): void {
    this.verdiqAuth.logout();
    this.renewloopAuth.logout();
  }

  private once(app: BrokeredApp, run: () => Promise<void>): Promise<void> {
    let pending = this.inflight.get(app);
    if (!pending) {
      pending = run().finally(() => this.inflight.delete(app));
      this.inflight.set(app, pending);
    }
    return pending;
  }

  private broker(appId: BrokeredApp): Promise<BrokeredSession> {
    return firstValueFrom(
      this.http
        .post<{ data: BrokeredSession }>(`${environment.apiBaseUrl}/app-sessions/${appId}`, {})
        .pipe(map((res) => res.data)),
    );
  }
}
