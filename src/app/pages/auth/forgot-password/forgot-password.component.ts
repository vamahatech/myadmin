import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AuthService } from '../../../core/services/auth.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { AuthLayoutComponent } from '../../../shared/components/auth-layout/auth-layout.component';

/** Ask for a reset link. The answer is the same whether or not the email has an account. */
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, AuthLayoutComponent],
  template: `
    <app-auth-layout>
      @if (sent()) {
        <span class="inline-flex h-11 w-11 items-center justify-center rounded-full bg-success/10 text-success">
          <app-icon name="check-circle" [size]="22" />
        </span>
        <h1 class="mt-4 text-2xl leading-8 font-semibold">Check your email</h1>
        <p class="muted mt-2">
          If <strong class="text-text">{{ email.trim() }}</strong> has an admin account, a link to choose a new
          password is on its way. It works once and expires in 30 minutes.
        </p>
        <p class="muted mt-4 text-sm">No email after a few minutes? Check spam, or ask a superadmin to send you a reset link.</p>
        <a routerLink="/login" class="btn btn-secondary w-full min-h-11 mt-8">
          <app-icon name="arrow-left" [size]="16" /> Back to sign in
        </a>
      } @else {
        <h1 class="text-2xl leading-8 font-semibold">Forgot your password?</h1>
        <p class="muted mt-1">Enter your admin email and we'll send you a link to choose a new one.</p>

        <form (ngSubmit)="submit()" class="mt-8 space-y-5" novalidate>
          <div>
            <label for="email" class="field-label">Email</label>
            <input id="email" name="email" type="email" [(ngModel)]="email" required autocomplete="username"
              class="input min-h-11" placeholder="you@vamaha.tech" aria-describedby="forgot-error" />
          </div>

          <p id="forgot-error" class="field-error flex items-center gap-1.5 min-h-[18px]" role="alert">
            @if (error()) {
              <app-icon name="alert-triangle" [size]="14" /> {{ error() }}
            }
          </p>

          <button type="submit" class="btn w-full min-h-11" [disabled]="submitting() || !email.trim()">
            @if (submitting()) {
              <app-icon name="loader" [size]="16" class="animate-spin motion-reduce:animate-none" /> Sending…
            } @else {
              Send reset link
            }
          </button>
          <a routerLink="/login" class="btn btn-tertiary w-full min-h-11">
            <app-icon name="arrow-left" [size]="16" /> Back to sign in
          </a>
        </form>
      }
    </app-auth-layout>
  `,
})
export class ForgotPasswordComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly meta = inject(Meta);

  email = '';
  readonly submitting = signal(false);
  readonly sent = signal(false);
  readonly error = signal('');

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    this.email = this.route.snapshot.queryParamMap.get('email') ?? '';
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.error.set('');
    try {
      await this.auth.forgotPassword(this.email.trim());
      this.sent.set(true);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      this.error.set(
        status === 429
          ? 'Too many requests. Wait a minute and try again.'
          : status === 400
            ? 'Enter a valid email address.'
            : status === 0
              ? 'Cannot reach the server. Try again shortly.'
              : 'Something went wrong. Please try again.',
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
