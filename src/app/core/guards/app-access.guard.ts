import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRouteSnapshot, CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PermissionService, navModule } from '../services/permission.service';
import { ToastService } from '../services/toast.service';
import { AppNavItem, findApp } from '../models/app-registry.model';

/** The app route (the one carrying `appId` route data) at or above `route`. */
function appRouteOf(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot | null {
  for (let r: ActivatedRouteSnapshot | null = route; r; r = r.parent) {
    if (r.data?.['appId']) return r;
  }
  return null;
}

/**
 * Module id for a child route: the nav item whose path (or activePrefixes) matches
 * the route's first segment, e.g. vamaha '' and 'articles/:id' → 'articles'.
 */
function moduleFor(child: ActivatedRouteSnapshot, navItems: AppNavItem[]): string {
  const segment = (child.routeConfig?.path ?? '').split('/')[0];
  const item = navItems.find(
    (n) => n.path.split('/')[0] === segment || (n.activePrefixes ?? []).includes(segment),
  );
  return item ? navModule(item) : segment;
}

/**
 * On an app route: the admin must have access to the app (from GET /auth/me).
 * Runs before the app's session guard, so no broker session is requested for an
 * app they can't open. The backend enforces the same rules.
 */
export const appAccessGuard: CanActivateFn = async (route) => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;
  const auth = inject(AuthService);
  const perms = inject(PermissionService);
  const router = inject(Router);
  const toast = inject(ToastService);
  if (!(await auth.ensureUser())) return router.createUrlTree(['/login']);

  const appId = route.data['appId'] as string;
  if (perms.canApp(appId)) return true;
  toast.error(`You don't have access to ${findApp(appId)?.name ?? 'this app'}.`);
  return router.createUrlTree(['/']);
};

/** Admin management pages: superadmins only (the API refuses everyone else too). */
export const superadminGuard: CanActivateFn = async () => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;
  const auth = inject(AuthService);
  const perms = inject(PermissionService);
  const router = inject(Router);
  const toast = inject(ToastService);
  if (!(await auth.ensureUser())) return router.createUrlTree(['/login']);
  if (perms.isSuperadmin()) return true;
  toast.error('Only superadmins can manage admins.');
  return router.createUrlTree(['/settings']);
};

/** On an app's children: the admin must have the module the page belongs to. */
export const appModuleGuard: CanActivateChildFn = async (child) => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;
  const auth = inject(AuthService);
  const perms = inject(PermissionService);
  const router = inject(Router);
  const toast = inject(ToastService);
  if (!(await auth.ensureUser())) return router.createUrlTree(['/login']);

  const appRoute = appRouteOf(child);
  if (!appRoute || child.routeConfig?.redirectTo !== undefined) return true;
  const appId = appRoute.data['appId'] as string;
  const navItems = (appRoute.data['navItems'] ?? []) as AppNavItem[];
  const module = moduleFor(child, navItems);
  if (perms.can(appId, module, 'view')) return true;

  // Send them to the first module they can use instead of the directory, if any.
  const allowed = navItems.find((n) => perms.canNav(appId, n));
  const base = '/' + (appRoute.routeConfig?.path ?? '');
  if (allowed && navModule(allowed) !== module) {
    return router.createUrlTree([allowed.path ? `${base}/${allowed.path}` : base]);
  }
  toast.error("You don't have access to that page.");
  return router.createUrlTree(['/']);
};
