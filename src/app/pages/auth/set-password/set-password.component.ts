import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { AuthLayoutComponent } from '../../../shared/components/auth-layout/auth-layout.component';
import { PasswordFieldsComponent } from '../../../shared/components/password-fields/password-fields.component';

type Mode = 'reset' | 'invite';

const COPY: Record<Mode, { title: string; body: string; button: string; done: string }> = {
  reset: {
    title: 'Choose a new password',
    body: 'You’ll be signed in right after, and signed out everywhere else.',
    button: 'Save password and sign in',
    done: 'Password changed. You’re signed in.',
  },
  invite: {
    title: 'Set up your account',
    body: 'Choose a password for your Vamaha admin account.',
    button: 'Create password and sign in',
    done: 'Welcome! Your account is ready.',
  },
};

/** Completes an emailed reset link (/reset-password) or invite (/accept-invite). */
@Component({
  selector: 'app-set-password',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, AuthLayoutComponent, PasswordFieldsComponent],
  template: `
    <app-auth-layout>
      @if (!token) {
        <h1 class="text-2xl leading-8 font-semibold">This link is incomplete</h1>
        <p class="muted mt-2">Open the link from your email again, or ask for a new one.</p>
        <a [routerLink]="mode === 'reset' ? '/forgot-password' : '/login'" class="btn w-full min-h-11 mt-8">
          {{ mode === 'reset' ? 'Request a new link' : 'Go to sign in' }}
        </a>
      } @else {
        <h1 class="text-2xl leading-8 font-semibold">{{ copy.title }}</h1>
        <p class="muted mt-1">{{ copy.body }}</p>

        <form (ngSubmit)="submit()" class="mt-8 space-y-5" novalidate>
          <app-password-fields [(password)]="password" [(confirm)]="confirm" newLabel="Password" />

          <p class="field-error flex items-start gap-1.5 min-h-[18px]" role="alert">
            @if (error()) {
              <app-icon name="alert-triangle" [size]="14" class="mt-0.5" />
              <span>{{ error() }}
                @if (linkDead()) {
                  <a [routerLink]="mode === 'reset' ? '/forgot-password' : '/login'" class="font-semibold underline">
                    {{ mode === 'reset' ? 'Request a new link' : 'Ask for a new invite' }}
                  </a>
                }
              </span>
            }
          </p>

          <button type="submit" class="btn w-full min-h-11" [disabled]="submitting() || !valid()">
            @if (submitting()) {
              <app-icon name="loader" [size]="16" class="animate-spin motion-reduce:animate-none" /> Saving…
            } @else {
              {{ copy.button }}
            }
          </button>
        </form>
      }
    </app-auth-layout>
  `,
})
export class SetPasswordComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly meta = inject(Meta);

  readonly mode = (this.route.snapshot.data['mode'] as Mode) ?? 'reset';
  readonly copy = COPY[this.mode];
  readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';

  readonly password = signal('');
  readonly confirm = signal('');
  readonly valid = computed(() => this.password().length >= 10 && this.password() === this.confirm());
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly linkDead = signal(false);

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }

  async submit(): Promise<void> {
    if (this.submitting() || !this.valid()) return;
    this.submitting.set(true);
    this.error.set('');
    this.linkDead.set(false);
    try {
      if (this.mode === 'invite') await this.auth.acceptInvite(this.token, this.password());
      else await this.auth.resetPassword(this.token, this.password());
      this.toast.success(this.copy.done);
      await this.router.navigate(['/']);
    } catch (err: unknown) {
      const e = err as { status?: number; error?: { message?: string | string[] } };
      if (e.status === 400) {
        const msg = Array.isArray(e.error?.message) ? e.error?.message[0] : e.error?.message;
        const dead = !msg || /invalid or has expired/i.test(msg);
        this.linkDead.set(dead);
        this.error.set(dead ? 'This link is invalid or has expired.' : msg!);
      } else if (e.status === 429) {
        this.error.set('Too many attempts. Wait a minute and try again.');
      } else {
        this.error.set('Something went wrong. Please try again.');
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
