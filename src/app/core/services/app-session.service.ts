import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { VerdiqAuthService } from './verdiq/verdiq-auth';
import { RenewloopAuthService } from './renewloop/renewloop-auth';

/**
 * Cross-backend silent-login for apps whose backend differs from
 * vamaha-backend (currently Verdiq and RenewLoop). Each auth service already
 * persists its own token via its own StorageService, so this only logs in
 * when no valid token exists yet this browser session.
 */
@Injectable({ providedIn: 'root' })
export class AppSessionService {
  private readonly verdiqAuth = inject(VerdiqAuthService);
  private readonly renewloopAuth = inject(RenewloopAuthService);

  async ensureVerdiqSession(): Promise<void> {
    if (this.verdiqAuth.getToken() && !this.verdiqAuth.isTokenExpired()) return;
    await firstValueFrom(
      this.verdiqAuth.login({
        email: environment.verdiq.serviceEmail,
        password: environment.verdiq.servicePassword,
      }),
    );
  }

  async ensureRenewloopSession(): Promise<void> {
    if (this.renewloopAuth.getToken() && !this.renewloopAuth.isTokenExpired()) return;
    await firstValueFrom(
      this.renewloopAuth.login({
        email: environment.renewloop.serviceEmail,
        password: environment.renewloop.servicePassword,
      }),
    );
  }

  /** Clears every service-credential session. Called from AuthService.logout()
   * so signing out of the shell doesn't leave a service-account JWT behind
   * in localStorage for any app backend. Keeps its existing name (it's
   * already called from AuthService.logout()) even though it now clears
   * both sessions — renaming it repo-wide is out of scope here. */
  clearVerdiqSession(): void {
    this.verdiqAuth.logout();
    this.renewloopAuth.logout();
  }
}
