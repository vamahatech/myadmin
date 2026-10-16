import { Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppTile } from '../../../core/models/app-registry.model';
import { CommandPaletteService } from '../../../core/services/command-palette.service';
import { AccountMenuComponent } from '../account-menu/account-menu.component';
import { AppSwitcherComponent } from '../app-switcher/app-switcher.component';
import { IconComponent } from '../icon/icon.component';

/**
 * The one header used on every console screen: Vamaha brand on the left,
 * the current app (with switcher) when inside one, account menu on the
 * right. Same 64px height and edge-to-edge padding on every screen.
 */
@Component({
  selector: 'app-global-header',
  standalone: true,
  imports: [RouterLink, AccountMenuComponent, AppSwitcherComponent, IconComponent],
  templateUrl: './global-header.component.html',
  host: { class: 'block shrink-0' },
})
export class GlobalHeaderComponent {
  /** Set inside an app; omitted on the directory and settings screens. */
  readonly app = input<AppTile | undefined>(undefined);
  /** Whether the mobile nav drawer is open — drives the menu button state. */
  readonly navOpen = input(false);
  readonly navToggle = output<void>();

  readonly palette = inject(CommandPaletteService);
  /** Shortcut label for the search trigger: ⌘K on Apple platforms, Ctrl K elsewhere. */
  readonly shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';
}
