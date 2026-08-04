import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { VerdiqAuthService } from './verdiq/verdiq-auth';

/**
 * Cross-backend silent-login for apps whose backend differs from
 * vamaha-backend (currently just Verdiq). VerdiqAuthService already persists
 * its token via StorageService, so this only logs in when no token exists
 * yet this browser session.
 */
@Injectable({ providedIn: 'root' })
export class AppSessionService {
  private readonly verdiqAuth = inject(VerdiqAuthService);

  async ensureVerdiqSession(): Promise<void> {
    if (this.verdiqAuth.getToken() && !this.verdiqAuth.isTokenExpired()) return;
    await firstValueFrom(
      this.verdiqAuth.login({
        email: environment.verdiq.serviceEmail,
        password: environment.verdiq.servicePassword,
      }),
    );
  }

  /** Clears the verdiq-backend session (token + user signal). Called from
   * AuthService.logout() so signing out of the shell doesn't leave a
   * verdiq service-account JWT behind in localStorage. */
  clearVerdiqSession(): void {
    this.verdiqAuth.logout();
  }
}
