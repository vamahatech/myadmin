import { Component, HostListener, Input, Output, EventEmitter } from '@angular/core';

// Generic overlay dialog. Content is projected in, so any feature form (or a
// future confirm prompt) can drop into it without a bespoke popup each time.
// Always centred in the viewport, so it's visible regardless of table scroll
// position — the problem with the old top-of-page inline forms.
@Component({
  selector: 'app-modal',
  imports: [],
  templateUrl: './modal.html',
  styleUrl: './modal.sass',
})
export class Modal {
  @Input() open = false;
  @Input() title = '';
  @Output() closed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.close();
  }

  close(): void {
    this.closed.emit();
  }
}
