import { Component, inject } from '@angular/core';
import { ThemePref, ThemeService } from '../../../core/services/theme.service';
import { IconComponent, IconName } from '../icon/icon.component';

/** Light / Dark / System segmented control (account menu, Settings). */
@Component({
  selector: 'app-theme-switch',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="segmented w-full" role="group" aria-label="Theme">
      @for (o of options; track o.value) {
        <button
          type="button"
          class="flex-1 justify-center"
          [attr.aria-pressed]="theme.pref() === o.value"
          (click)="theme.set(o.value)">
          <app-icon [name]="o.icon" [size]="14" />
          {{ o.label }}
        </button>
      }
    </div>
  `,
  host: { class: 'block' },
})
export class ThemeSwitchComponent {
  readonly theme = inject(ThemeService);
  readonly options: { value: ThemePref; label: string; icon: IconName }[] = [
    { value: 'light', label: 'Light', icon: 'sun' },
    { value: 'dark', label: 'Dark', icon: 'moon' },
    { value: 'system', label: 'System', icon: 'monitor' },
  ];
}
