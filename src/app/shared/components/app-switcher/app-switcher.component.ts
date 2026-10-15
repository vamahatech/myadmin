import { Component, ElementRef, HostListener, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_REGISTRY, AppTile } from '../../../core/models/app-registry.model';
import { IconComponent } from '../icon/icon.component';

/**
 * Header control showing the current app; opens a list of every studio app
 * (from APP_REGISTRY, the same source as the directory) so admins can jump
 * between apps without going back to the directory first.
 */
@Component({
  selector: 'app-switcher',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './app-switcher.component.html',
  host: { class: 'relative block min-w-0' },
})
export class AppSwitcherComponent {
  readonly current = input.required<AppTile>();
  readonly apps = APP_REGISTRY;

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
}
