import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { RenewloopAuthService } from '../services/renewloop/renewloop-auth';
import { environment } from '../../../environments/environment';

/**
 * Attaches the RenewLoop-backend (sbmint) JWT, obtained via silent
 * service-credential login (see AppSessionService), to sbmint calls only.
 * Mirrors verdiqAuthInterceptor's URL-prefix gating so other backends'
 * calls are untouched.
 */
const RENEWLOOP_BASE = environment.renewloop.apiBaseUrl.replace(/\/$/, '') + '/';

export const renewloopAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(RenewloopAuthService).getToken();
  if (token && req.url.startsWith(RENEWLOOP_BASE)) {
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }
  return next(req);
};
