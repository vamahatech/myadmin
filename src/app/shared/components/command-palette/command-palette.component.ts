import {
  Component, ElementRef, HostListener, computed, effect, inject, signal, viewChild,
} from '@angular/core';
import { Router, Routes } from '@angular/router';
import { APP_REGISTRY, AppNavItem, navLink } from '../../../core/models/app-registry.model';
import { CommandPaletteService } from '../../../core/services/command-palette.service';
import { ThemeService } from '../../../core/services/theme.service';
import { AuthService } from '../../../core/services/auth.service';
import { IconComponent, IconName } from '../icon/icon.component';

interface Command {
  id: string;
  label: string;
  /** Secondary text, e.g. the app a module belongs to. */
  hint?: string;
  group: 'Applications' | 'Go to' | 'Actions';
  icon?: IconName;
  image?: string;
  run: () => void;
}

/**
 * ⌘K / Ctrl+K command palette: jump to any app or module, or run a quick
 * action. Modules come from each app route's `navItems`, so new pages show up
 * automatically. Combobox + listbox pattern; ↑/↓, Enter, Esc.
 */
@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './command-palette.component.html',
})
export class CommandPaletteComponent {
  readonly palette = inject(CommandPaletteService);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('search');

  readonly query = signal('');
  readonly activeIndex = signal(0);
  private opener: HTMLElement | null = null;

  private readonly commands: Command[] = this.buildCommands();

  readonly results = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.commands;
    return this.commands
      .map(c => ({ c, score: score(`${c.label} ${c.hint ?? ''}`.toLowerCase(), q) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(r => r.c);
  });

  /** Results grouped for display, keeping a flat index for keyboard nav. */
  readonly grouped = computed(() => {
    const groups: { label: string; items: { cmd: Command; index: number }[] }[] = [];
    this.results().forEach((cmd, index) => {
      let g = groups.find(x => x.label === cmd.group);
      if (!g) groups.push((g = { label: cmd.group, items: [] }));
      g.items.push({ cmd, index });
    });
    return groups;
  });

  constructor() {
    effect(() => {
      if (this.palette.open()) {
        this.opener = document.activeElement as HTMLElement | null;
        this.query.set('');
        this.activeIndex.set(0);
        setTimeout(() => this.input()?.nativeElement.focus());
      } else if (this.opener) {
        this.opener.focus?.();
        this.opener = null;
      }
    });
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKey(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      // Only once signed in — the login page has nothing to jump to.
      if (!this.auth.isLoggedIn()) return;
      e.preventDefault();
      this.palette.toggle();
    }
  }

  onQuery(value: string): void {
    this.query.set(value);
    this.activeIndex.set(0);
  }

  onKeydown(e: KeyboardEvent): void {
    const n = this.results().length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (n) this.activeIndex.set((this.activeIndex() + 1) % n);
      this.scrollActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (n) this.activeIndex.set((this.activeIndex() - 1 + n) % n);
      this.scrollActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = this.results()[this.activeIndex()];
      if (cmd) this.execute(cmd);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.palette.hide();
    }
  }

  execute(cmd: Command): void {
    this.palette.hide();
    cmd.run();
  }

  private scrollActive(): void {
    setTimeout(() => document.getElementById(`cmd-${this.activeIndex()}`)?.scrollIntoView({ block: 'nearest' }));
  }

  private buildCommands(): Command[] {
    const go = (url: string) => () => void this.router.navigateByUrl(url);
    const out: Command[] = APP_REGISTRY.map(app => ({
      id: `app-${app.id}`,
      label: app.name,
      hint: app.tagline,
      group: 'Applications' as const,
      image: app.icon,
      run: go(app.route),
    }));

    for (const route of appRoutes(this.router.config)) {
      const app = APP_REGISTRY.find(a => a.id === route.data!['appId']);
      const base = '/' + route.path;
      for (const item of route.data!['navItems'] as AppNavItem[]) {
        out.push({
          id: `nav-${base}-${item.path}`,
          label: item.label,
          hint: app?.name,
          group: 'Go to',
          icon: item.icon,
          run: go(navLink(base, item)),
        });
      }
    }

    out.push(
      { id: 'act-new-article', label: 'New article', hint: 'Vamaha', group: 'Actions', icon: 'plus', run: go('/apps/vamaha/articles/new') },
      { id: 'act-home', label: 'All applications', group: 'Actions', icon: 'apps', run: go('/') },
      { id: 'act-settings', label: 'Settings', group: 'Actions', icon: 'settings', run: go('/settings') },
      { id: 'act-theme-light', label: 'Light theme', hint: 'Appearance', group: 'Actions', icon: 'sun', run: () => this.theme.set('light') },
      { id: 'act-theme-dark', label: 'Dark theme', hint: 'Appearance', group: 'Actions', icon: 'moon', run: () => this.theme.set('dark') },
      { id: 'act-theme-system', label: 'System theme', hint: 'Appearance', group: 'Actions', icon: 'monitor', run: () => this.theme.set('system') },
    );
    return out;
  }
}

function appRoutes(routes: Routes): Routes {
  return routes.filter(r => r.data?.['appId'] && Array.isArray(r.data?.['navItems']));
}

/** Tiny ranking: prefix > word-start > substring > in-order letters. 0 = no match. */
function score(text: string, q: string): number {
  if (text.startsWith(q)) return 4;
  if (text.includes(' ' + q)) return 3;
  if (text.includes(q)) return 2;
  let i = 0;
  for (const ch of text) if (ch === q[i]) i++;
  return i === q.length ? 1 : 0;
}
