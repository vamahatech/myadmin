import { Component, Input, Output, EventEmitter, signal, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Modal } from '../modal/modal';

// Type-to-confirm delete dialog. The confirm button stays disabled until the
// admin types the exact expectedText (the item's email/name/barcode) — a
// stronger guard than a bare browser confirm(), used for every destructive
// action in the panel (users, admins, products).
@Component({
  selector: 'app-confirm-delete-modal',
  imports: [Modal, FormsModule],
  templateUrl: './confirm-delete-modal.html',
  styleUrl: './confirm-delete-modal.sass',
})
export class ConfirmDeleteModal implements OnChanges {
  @Input() open = false;
  @Input() itemLabel = '';
  @Input() expectedText = '';
  @Output() confirmed = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  typed = '';
  readonly matches = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    // Reset the typed text whenever the dialog is (re)opened for a new item,
    // so a stale match from a previous delete can't carry over.
    if (changes['open'] && this.open) {
      this.typed = '';
      this.matches.set(false);
    }
  }

  onInput(): void {
    this.matches.set(this.typed === this.expectedText);
  }

  confirm(): void {
    if (!this.matches()) return;
    this.confirmed.emit();
  }

  close(): void {
    this.closed.emit();
  }
}
