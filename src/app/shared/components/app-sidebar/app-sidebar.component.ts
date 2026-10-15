import { Component, HostListener, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { AppNavItem } from '../../../core/models/app-registry.model';
import { IconComponent } from '../icon/icon.component';

/**
 * Shared app navigation. Renders whatever items the current app supplies.
 * md+: fixed 240px rail. Below md: an off-canvas drawer the header's menu
 * button opens; closes on Escape, backdrop tap, or choosing an item.
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
  /** Mobile drawer state (ignored at md+ where the rail is always shown). */
  readonly open = input(false);
  readonly closed = output<void>();

  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  link(item: AppNavItem): string {
    return item.path ? `${this.basePath()}/${item.path}` : this.basePath();
  }

  isActive(item: AppNavItem): boolean {
    const path = this.url().split(/[?#]/)[0];
    const target = this.link(item);
    if (path === target) return true;
    // The landing item ('') only matches exactly, or it would light up for
    // every other page in the app.
    if (item.path && path.startsWith(target + '/')) return true;
    return (item.activePrefixes ?? []).some(p => {
      const prefix = `${this.basePath()}/${p}`;
      return path === prefix || path.startsWith(prefix + '/');
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.closed.emit();
  }
}
