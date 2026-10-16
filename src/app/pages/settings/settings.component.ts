import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AuthService } from '../../core/services/auth.service';
import { GlobalHeaderComponent } from '../../shared/components/global-header/global-header.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ThemeSwitchComponent } from '../../shared/components/theme-switch/theme-switch.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [RouterLink, GlobalHeaderComponent, PageHeaderComponent, IconComponent, ThemeSwitchComponent],
  templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);

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

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
