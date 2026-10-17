import { Component, computed, input, model, signal } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

let nextId = 0;

/**
 * New password + confirm, with show/hide and the rule checklist. Used by the reset,
 * invite and change-password forms so they all apply the same rule (≥ 10 characters,
 * the backend's minimum) and look the same.
 *   <app-password-fields [(password)]="pw" [(confirm)]="pw2" />
 */
@Component({
  selector: 'app-password-fields',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="space-y-5">
      <div>
        <label [for]="id + '-new'" class="field-label">{{ newLabel() }}</label>
        <div class="relative">
          <input [id]="id + '-new'" [type]="show() ? 'text' : 'password'" autocomplete="new-password"
            class="input min-h-11 pr-12" [value]="password()" (input)="password.set($any($event.target).value)"
            [attr.aria-describedby]="id + '-rules'" />
          <button type="button" class="icon-btn absolute right-1 top-1/2 -translate-y-1/2"
            [attr.aria-label]="show() ? 'Hide passwords' : 'Show passwords'" [attr.aria-pressed]="show()"
            (click)="show.set(!show())">
            <app-icon [name]="show() ? 'eye-off' : 'eye'" [size]="18" />
          </button>
        </div>
      </div>
      <div>
        <label [for]="id + '-confirm'" class="field-label">Confirm password</label>
        <input [id]="id + '-confirm'" [type]="show() ? 'text' : 'password'" autocomplete="new-password"
          class="input min-h-11" [value]="confirm()" (input)="confirm.set($any($event.target).value)"
          [attr.aria-invalid]="mismatch() ? 'true' : null" />
      </div>
      <ul [id]="id + '-rules'" class="space-y-1 text-sm" aria-label="Password requirements">
        <li class="flex items-center gap-2" [class.text-success]="longEnough()" [class.text-text2]="!longEnough()">
          <app-icon [name]="longEnough() ? 'check' : 'chevron-right'" [size]="14" /> At least 10 characters
        </li>
        <li class="flex items-center gap-2" [class.text-success]="matches()" [class.text-text2]="!matches()">
          <app-icon [name]="matches() ? 'check' : 'chevron-right'" [size]="14" /> Both passwords match
        </li>
      </ul>
    </div>
  `,
})
export class PasswordFieldsComponent {
  readonly password = model('');
  readonly confirm = model('');
  readonly newLabel = input('New password');

  readonly id = `pw-${nextId++}`;
  readonly show = signal(false);
  readonly longEnough = computed(() => this.password().length >= 10);
  readonly matches = computed(() => this.password().length > 0 && this.password() === this.confirm());
  readonly mismatch = computed(() => this.confirm().length > 0 && this.password() !== this.confirm());
}
