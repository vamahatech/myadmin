import { Component, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { AppNavItem, AppTile, isNavActive, navLink } from '../../../core/models/app-registry.model';
import { IconComponent } from '../icon/icon.component';
import { PermissionService } from '../../../core/services/permission.service';

const COLLAPSED_KEY = 'vamaha_admin_sidebar_collapsed';

interface NavGroup {
  label: string;
  items: AppNavItem[];
}

/**
 * Shared app navigation. Renders whatever items the current app supplies,
 * grouped under section labels when items carry `group`.
 * md+: 240px rail, collapsible to a 64px icon rail (remembered per browser).
 * Below md: an off-canvas drawer the header's menu button opens; closes on
 * Escape, backdrop tap, or choosing an item.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './app-sidebar.component.html',
})
export class AppSidebarComponent {
  readonly items = input.required<AppNavItem[]>();
  /** Absolute base route of the app, e.g. '/apps/vamaha'. */
  readonly basePath = input.required<string>();
  readonly appName = input.required<string>();
  /** Registry entry for the header block (icon + tagline). */
  readonly app = input<AppTile | undefined>(undefined);
  /** Mobile drawer state (ignored at md+ where the rail is always shown). */
  readonly open = input(false);
  readonly closed = output<void>();

  /** md+ only — the mobile drawer always shows full labels. */
  readonly collapsed = signal(readCollapsed());

  readonly groups = computed<NavGroup[]>(() => {
    const out: NavGroup[] = [];
    const app = this.app();
    for (const item of this.items()) {
      if (app && !this.perms.canNav(app.id, item)) continue;
      const label = item.group ?? 'Modules';
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(item);
      else out.push({ label, items: [item] });
    }
    return out;
  });

  private readonly router = inject(Router);
  private readonly perms = inject(PermissionService);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  link(item: AppNavItem): string {
    return navLink(this.basePath(), item);
  }

  isActive(item: AppNavItem): boolean {
    return isNavActive(this.url(), this.basePath(), item);
  }

  toggleCollapsed(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      /* storage blocked — state just won't persist */
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.closed.emit();
  }
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}
