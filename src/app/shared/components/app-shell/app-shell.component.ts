import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

export interface AppShellNavItem {
  label: string;
  icon: string;
  path: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-shell.component.html',
})
export class AppShellComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly appName = this.route.snapshot.data['appName'] as string;
  readonly appIcon = this.route.snapshot.data['appIcon'] as string;
  readonly navItems = this.route.snapshot.data['navItems'] as AppShellNavItem[];
  readonly contentClass = this.route.snapshot.data['contentClass'] as string | undefined;
  readonly appInitial = this.appName.charAt(0).toUpperCase();

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

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
