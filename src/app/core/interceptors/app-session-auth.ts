import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { Observable, catchError, from, of, switchMap, throwError } from 'rxjs';

/**
 * Shared logic for the Verdiq / RenewLoop interceptors: make sure a fresh broker
 * session exists, attach it, and on a 401 refresh once and retry (the app token is
 * short-lived and may expire mid-session, or access may have changed).
 */
export function withAppSession(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  ensure: (force: boolean) => Promise<void>,
  token: () => string | null,
): Observable<HttpEvent<unknown>> {
  const send = () => {
    const t = token();
    return next(t ? req.clone({ setHeaders: { Authorization: `Bearer ${t}` } }) : req);
  };
  return from(ensure(false)).pipe(
    // Broker refused or unreachable: still send, so the page shows the app's own error.
    catchError(() => of(undefined)),
    switchMap(send),
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) return throwError(() => err);
      return from(ensure(true)).pipe(switchMap(send));
    }),
  );
}
