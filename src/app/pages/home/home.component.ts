import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { APP_REGISTRY } from '../../core/models/app-registry.model';
import { GlobalHeaderComponent } from '../../shared/components/global-header/global-header.component';
import { AppRowComponent } from '../../shared/components/app-row/app-row.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [GlobalHeaderComponent, AppRowComponent],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly apps = APP_REGISTRY;
  readonly countLabel = `${String(this.apps.length).padStart(2, '0')} ${this.apps.length === 1 ? 'application' : 'applications'}`;
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
}
