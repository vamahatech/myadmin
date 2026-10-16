import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AppSessionService } from '../../core/services/app-session.service';
import { AdminContentService } from '../../core/services/admin-content.service';
import { PushAdminService } from '../../core/services/push-admin.service';
import { AdminApi as VerdiqApi } from '../../core/services/verdiq/admin-api';
import { RenewloopAdminApi } from '../../core/services/renewloop/admin-api';
import { APP_REGISTRY } from '../../core/models/app-registry.model';
import { GlobalHeaderComponent } from '../../shared/components/global-header/global-header.component';
import { AppRowComponent, AppStatus } from '../../shared/components/app-row/app-row.component';

interface AppHealth {
  status: AppStatus;
  metric: string | null;
}

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [GlobalHeaderComponent, AppRowComponent],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly session = inject(AppSessionService);
  private readonly content = inject(AdminContentService);
  private readonly push = inject(PushAdminService);
  private readonly verdiq = inject(VerdiqApi);
  private readonly renewloop = inject(RenewloopAdminApi);

  readonly apps = APP_REGISTRY;
  readonly countLabel = `${String(this.apps.length).padStart(2, '0')} ${this.apps.length === 1 ? 'application' : 'applications'}`;
  readonly loading = signal(true);

  /** Per-app backend health + one headline number, filled in after load. */
  readonly health = signal<Record<string, AppHealth>>(
    Object.fromEntries(APP_REGISTRY.map(a => [a.id, { status: 'checking', metric: null }])),
  );

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
    this.checkHealth();
  }

  private checkHealth(): void {
    void this.probe('vamaha', () => this.content.listAll(), list => plural(list.length, 'article'));
    void this.probe('emi-planner', () => this.push.listTokens('emi-planner'), rows => plural(rows.length, 'device'));
    void this.probe(
      'verdiq',
      () => this.verdiq.getMetrics(),
      m => plural(m.counts.products, 'product'),
      () => this.session.ensureVerdiqSession(),
    );
    void this.probe(
      'renewloop',
      () => this.renewloop.getUsers({ limit: 1 }),
      p => plural(p.pagination.total, 'user'),
      () => this.session.ensureRenewloopSession(),
    );
  }

  private async probe<T>(
    id: string,
    request: () => Observable<T>,
    metric: (value: T) => string,
    before?: () => Promise<void>,
  ): Promise<void> {
    let next: AppHealth;
    try {
      if (before) await before();
      next = { status: 'ok', metric: metric(await firstValueFrom(request())) };
    } catch {
      next = { status: 'down', metric: null };
    }
    this.health.update(h => ({ ...h, [id]: next }));
  }
}
