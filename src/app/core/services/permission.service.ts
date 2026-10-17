import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { PermissionLevel, allows } from '../models/permissions.model';
import { APP_REGISTRY, AppNavItem, AppTile } from '../models/app-registry.model';

/**
 * What the signed-in admin may see and do, from GET /auth/me. Used to hide apps,
 * modules and actions the API would refuse anyway (the backend is the real check).
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthService);

  readonly permissions = computed(() => this.auth.user()?.permissions ?? null);
  readonly isSuperadmin = computed(() => this.permissions()?.superadmin === true);
  /** Apps this admin can open, in registry order. */
  readonly visibleApps = computed<AppTile[]>(() => APP_REGISTRY.filter((a) => this.canApp(a.id)));

  canApp(appId: string): boolean {
    return allows(this.permissions(), appId, null, 'view');
  }

  can(appId: string, module: string | null, level: PermissionLevel): boolean {
    return allows(this.permissions(), appId, module, level);
  }

  canNav(appId: string, item: AppNavItem): boolean {
    return this.can(appId, navModule(item), 'view');
  }
}

/** Module id of a sidebar item: its explicit `module`, else the first path segment. */
export function navModule(item: Pick<AppNavItem, 'path' | 'module'>): string {
  return item.module ?? item.path.split('/')[0];
}
