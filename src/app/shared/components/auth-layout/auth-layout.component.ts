import { Component } from '@angular/core';
import { APP_REGISTRY } from '../../../core/models/app-registry.model';

/**
 * Two-panel frame for signed-out pages (sign in, forgot/reset password, accept
 * invite): brand panel with the studio's apps on lg+, the form on the right.
 * Project the form; it sits in a max-w-sm column.
 */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  template: `
    <main class="min-h-screen bg-bg text-text grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section class="hidden lg:flex flex-col justify-between bg-surface border-r border-border px-12 py-10">
        <div>
          <img src="/vamaha-wordmark.png" alt="Vamaha" class="wordmark-light h-8 w-auto" />
          <img src="/vamaha-wordmark-dark.png" alt="Vamaha" class="wordmark-dark h-8 w-auto" />
        </div>

        <div class="max-w-md">
          <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-text2">Studio console</p>
          <h2 class="mt-3 text-[32px] leading-[40px] font-semibold tracking-[-0.01em]">
            Every studio app, managed from one place.
          </h2>
          <ul class="mt-8 flex flex-col gap-3" aria-label="Applications">
            @for (app of apps; track app.id) {
              <li class="flex items-center gap-3">
                <img [src]="'/' + app.icon" alt="" class="w-9 h-9 rounded-lg object-cover ring-1 ring-border bg-card" />
                <div class="min-w-0">
                  <p class="text-sm font-semibold">{{ app.name }}</p>
                  <p class="text-xs text-text2 truncate">{{ app.tagline }}</p>
                </div>
              </li>
            }
          </ul>
        </div>

        <p class="text-xs text-text2">Authorised access only.</p>
      </section>

      <section class="flex items-center justify-center px-[var(--page-px)] py-10">
        <div class="w-full max-w-sm">
          <div class="lg:hidden mb-10">
            <img src="/vamaha-wordmark.png" alt="Vamaha" class="wordmark-light h-7 w-auto" />
            <img src="/vamaha-wordmark-dark.png" alt="Vamaha" class="wordmark-dark h-7 w-auto" />
          </div>
          <ng-content />
          <p class="lg:hidden text-center text-text2 text-xs mt-10">Authorised access only.</p>
        </div>
      </section>
    </main>
  `,
})
export class AuthLayoutComponent {
  readonly apps = APP_REGISTRY;
}
