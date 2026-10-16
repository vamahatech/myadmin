import { Component, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { IconComponent } from '../icon/icon.component';
import { ThemeSwitchComponent } from '../theme-switch/theme-switch.component';

/**
 * Header account trigger + dropdown: who is signed in, a link to the
 * existing /settings page, and sign-out. Disclosure pattern (button with
 * aria-expanded) — closes on Escape, outside click, or choosing an item.
 */
@Component({
  selector: 'app-account-menu',
  standalone: true,
  imports: [RouterLink, IconComponent, ThemeSwitchComponent],
  templateUrl: './account-menu.component.html',
  host: { class: 'relative block' },
})
export class AccountMenuComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  readonly open = signal(false);

  toggle(): void {
    this.open.update(v => !v);
  }

  close(returnFocus = false): void {
    if (!this.open()) return;
    this.open.set(false);
    if (returnFocus) this.trigger().nativeElement.focus();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close(true);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  logout(): void {
    this.open.set(false);
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
