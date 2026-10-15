import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppTile } from '../../../core/models/app-registry.model';
import { AccountMenuComponent } from '../account-menu/account-menu.component';
import { AppSwitcherComponent } from '../app-switcher/app-switcher.component';
import { IconComponent } from '../icon/icon.component';

/**
 * The one header used on every console screen: Vamaha brand on the left,
 * the current app (with switcher) when inside one, account menu on the
 * right. Same 64px height and spacing everywhere.
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
  /** Constrain content width (directory) instead of spanning the viewport (apps). */
  readonly contained = input(false);
  /** Whether the mobile nav drawer is open — drives the menu button state. */
  readonly navOpen = input(false);
  readonly navToggle = output<void>();
}
