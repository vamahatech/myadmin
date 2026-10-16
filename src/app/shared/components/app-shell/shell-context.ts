import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { AppNavItem, findApp, isNavActive, navLink } from '../../../core/models/app-registry.model';

/**
 * Per-app context provided by AppShellComponent to everything rendered inside
 * it (sidebar, page headers, pages). Lets app-page-header build a default
 * breadcrumb — "App › Module › Page" — without each page wiring one.
 * Inject with { optional: true }: it is absent outside an app (home, settings).
 */
@Injectable()
export class ShellContext {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly data = this.route.snapshot.data;
  readonly app = findApp(this.data['appId'] as string);
  readonly appName = this.app?.name ?? (this.data['appName'] as string);
  readonly navItems = (this.data['navItems'] as AppNavItem[]) ?? [];
  readonly basePath = '/' + (this.route.snapshot.routeConfig?.path ?? '');

  readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly activeItem = computed(() => this.navItems.find(i => isNavActive(this.url(), this.basePath, i)));

  link(item: AppNavItem): string {
    return navLink(this.basePath, item);
  }
}
