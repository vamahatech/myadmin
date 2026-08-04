import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { VerdiqAuthService } from '../services/verdiq/verdiq-auth';
import { environment } from '../../../environments/environment';

/**
 * Attaches the verdiq-backend JWT (obtained via silent service-credential
 * login, see AppSessionService) to verdiq-backend calls only. Mirrors
 * authInterceptor's URL-prefix gating so vamaha-backend calls are untouched.
 */
// Normalized once with a trailing slash so a bare hostname prefix match
// (e.g. `...onrender.com`) can't also match a spoofed host like
// `...onrender.com.evil.com/...`.
const VERDIQ_BASE = environment.verdiq.apiBaseUrl.replace(/\/$/, '') + '/';

export const verdiqAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(VerdiqAuthService).getToken();
  if (token && req.url.startsWith(VERDIQ_BASE)) {
    return next(
      req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }),
    );
  }
  return next(req);
};
