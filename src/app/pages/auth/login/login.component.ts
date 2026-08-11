import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);

  email = '';
  password = '';
  readonly status = signal<'idle' | 'submitting' | 'error'>('idle');
  readonly error = signal<string>('');
  readonly pressed = signal(false);
  readonly showPassword = signal(false);

  /** Presses the ink-seal on the submit button; the animation clears the flag itself. */
  stamp(): void {
    this.pressed.set(true);
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    if (this.auth.isLoggedIn()) void this.router.navigate(['/']);
  }

  async submit(): Promise<void> {
    if (this.status() === 'submitting') return;
    this.status.set('submitting');
    this.error.set('');
    try {
      await this.auth.login(this.email.trim(), this.password);
      await this.router.navigate(['/']);
    } catch (err: unknown) {
      this.status.set('error');
      this.error.set(this.messageFor(err));
    }
  }

  private messageFor(err: unknown): string {
    const status = (err as { status?: number })?.status;
    if (status === 401) return 'Invalid email or password.';
    if (status === 0) return 'Cannot reach the server. Try again shortly.';
    return 'Something went wrong. Please try again.';
  }
}
