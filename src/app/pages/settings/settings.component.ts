import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AuthService } from '../../core/services/auth.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { APP_REGISTRY } from '../../core/models/app-registry.model';
import { APP_ROLE_LABELS } from '../../core/models/permissions.model';
import { GlobalHeaderComponent } from '../../shared/components/global-header/global-header.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ThemeSwitchComponent } from '../../shared/components/theme-switch/theme-switch.component';
import { PasswordFieldsComponent } from '../../shared/components/password-fields/password-fields.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [RouterLink, GlobalHeaderComponent, PageHeaderComponent, IconComponent, ThemeSwitchComponent, PasswordFieldsComponent],
  templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly perms = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly toast = inject(ToastService);

  /** "RenewLoop · Editor · Feedback, Errors" lines for the signed-in admin. */
  readonly myAccess = computed(() => {
    const p = this.perms.permissions();
    if (!p || p.superadmin) return [];
    return APP_REGISTRY.filter((a) => p.apps[a.id]).map((a) => {
      const g = p.apps[a.id];
      return {
        name: a.name,
        icon: a.icon,
        role: APP_ROLE_LABELS[g.role],
        modules: g.modules.length ? g.modules.join(', ') : 'All modules',
      };
    });
  });

  // Change password
  currentPassword = '';
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly changing = signal(false);
  readonly changeError = signal('');
  readonly canChange = computed(
    () => this.newPassword().length >= 10 && this.newPassword() === this.confirmPassword(),
  );

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      await this.auth.loadUser();
    } catch {
      this.auth.logout();
      void this.router.navigate(['/login']);
    }
  }

  async changePassword(): Promise<void> {
    if (this.changing() || !this.canChange() || !this.currentPassword) return;
    this.changing.set(true);
    this.changeError.set('');
    try {
      await this.auth.changePassword(this.currentPassword, this.newPassword());
      this.currentPassword = '';
      this.newPassword.set('');
      this.confirmPassword.set('');
      this.toast.success('Password changed. Other sessions were signed out.');
    } catch (err: unknown) {
      const e = err as { status?: number; error?: { message?: string | string[] } };
      const msg = Array.isArray(e.error?.message) ? e.error?.message[0] : e.error?.message;
      this.changeError.set(
        e.status === 400 && msg
          ? msg
          : e.status === 429
            ? 'Too many attempts. Wait a minute and try again.'
            : 'Could not change your password. Please try again.',
      );
    } finally {
      this.changing.set(false);
    }
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
