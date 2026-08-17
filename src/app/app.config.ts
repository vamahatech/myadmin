import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { verdiqAuthInterceptor } from './core/interceptors/verdiq-auth.interceptor';
import { renewloopAuthInterceptor } from './core/interceptors/renewloop-auth.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, verdiqAuthInterceptor, renewloopAuthInterceptor, loadingInterceptor]),
    ),
    provideRouter(routes),
  ],
};
