import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { APP_REGISTRY } from '../../core/models/app-registry.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly apps = APP_REGISTRY;
  readonly loading = signal(true);

  ngOnInit(): void {
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      await this.auth.loadUser();
    } catch {
      this.auth.logout();
      void this.router.navigate(['/login']);
      return;
    }
    this.loading.set(false);
  }
  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
