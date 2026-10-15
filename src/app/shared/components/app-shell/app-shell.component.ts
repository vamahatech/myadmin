import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AppNavItem, findApp } from '../../../core/models/app-registry.model';
import { GlobalHeaderComponent } from '../global-header/global-header.component';
import { AppSidebarComponent } from '../app-sidebar/app-sidebar.component';

/**
 * Layout shared by every studio app: global header, the app's own sidebar
 * navigation (from route data), and a padded content area. Apps differ only
 * in the `appId` / `navItems` they pass through route data.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, GlobalHeaderComponent, AppSidebarComponent],
  templateUrl: './app-shell.component.html',
})
export class AppShellComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly data = this.route.snapshot.data;
  readonly appName = this.data['appName'] as string;
  readonly app = findApp(this.data['appId'] as string);
  readonly navItems = this.data['navItems'] as AppNavItem[];
  /** Optional app-scoped class (e.g. Verdiq's legacy token scope). */
  readonly contentClass = this.data['contentClass'] as string | undefined;
  readonly basePath = '/' + (this.route.snapshot.routeConfig?.path ?? '');

  readonly navOpen = signal(false);

  ngOnInit(): void {
    void this.loadUser();
  }

  private async loadUser(): Promise<void> {
    try {
      await this.auth.loadUser();
    } catch {
      this.auth.logout();
      void this.router.navigate(['/login']);
    }
  }
}
