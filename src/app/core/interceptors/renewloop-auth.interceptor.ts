import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { RenewloopAuthService } from '../services/renewloop/renewloop-auth';
import { environment } from '../../../environments/environment';
import { AppSessionService } from '../services/app-session.service';
import { withAppSession } from './app-session-auth';

/**
 * Attaches the RenewLoop-backend (sbmint) JWT, issued by the
 * vamaha-backend session broker (see AppSessionService; refreshed when it expires), to sbmint calls only.
 * Mirrors verdiqAuthInterceptor's URL-prefix gating so other backends'
 * calls are untouched.
 */
const RENEWLOOP_BASE = environment.renewloop.apiBaseUrl.replace(/\/$/, '') + '/';

export const renewloopAuthInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(RENEWLOOP_BASE)) return next(req);
  const auth = inject(RenewloopAuthService);
  const session = inject(AppSessionService);
  return withAppSession(req, next, (force) => session.ensureRenewloopSession(force), () => auth.getToken());
};
