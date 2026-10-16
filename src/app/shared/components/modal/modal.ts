import {
  Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild,
} from '@angular/core';
import { IconComponent } from '../icon/icon.component';

let nextId = 0;

// Generic overlay dialog. Content is projected in, so any feature form or
// confirm prompt can drop into it without a bespoke popup each time. Always
// centred in the viewport. Moves focus into the panel on open, keeps Tab
// inside it, and returns focus to the opener on close.
@Component({
  selector: 'app-modal',
  imports: [IconComponent],
  templateUrl: './modal.html',
  styleUrl: './modal.sass',
})
export class Modal implements OnChanges {
  @Input() open = false;
  @Input() title = '';
  @Input() size: 'md' | 'sm' = 'md';
  @Output() closed = new EventEmitter<void>();

  @ViewChild('panel') private panel?: ElementRef<HTMLElement>;
  readonly titleId = `modal-title-${nextId++}`;
  private opener: HTMLElement | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['open']) return;
    if (this.open) {
      this.opener = document.activeElement as HTMLElement | null;
      // Wait for the @if block to render before focusing.
      setTimeout(() => this.focusFirst());
    } else if (this.opener) {
      this.opener.focus?.();
      this.opener = null;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.close();
  }

  close(): void {
    this.closed.emit();
  }

  trapFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const items = this.focusables();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && document.activeElement === last) {
      first.focus();
      event.preventDefault();
    }
  }

  private focusFirst(): void {
    const panel = this.panel?.nativeElement;
    if (!panel) return;
    // Prefer the first field or action in the body over the header close button.
    const body = this.focusables().filter(el => !el.closest('.modal-head'));
    (body[0] ?? panel).focus();
  }

  private focusables(): HTMLElement[] {
    const panel = this.panel?.nativeElement;
    if (!panel) return [];
    return Array.from(panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
  }
}
