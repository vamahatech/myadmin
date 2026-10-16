import { Component, inject } from '@angular/core';
import { ConfirmService } from '../../../core/services/confirm.service';
import { Modal } from '../modal/modal';

/** Root host for ConfirmService prompts. Mounted once in app.html. */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [Modal],
  template: `
    @let p = confirm.pending();
    <app-modal [open]="!!p" [title]="p?.title ?? ''" size="sm" (closed)="confirm.settle(false)">
      @if (p) {
        <p class="text-sm leading-[21px] text-text2 whitespace-pre-line">{{ p.message }}</p>
        <div class="mt-5 flex justify-end gap-2">
          <button type="button" class="btn btn-secondary" (click)="confirm.settle(false)">Cancel</button>
          <button
            type="button"
            class="btn"
            [class.btn-danger]="p.tone === 'danger'"
            (click)="confirm.settle(true)">
            {{ p.confirmLabel ?? 'Confirm' }}
          </button>
        </div>
      }
    </app-modal>
  `,
})
export class ConfirmDialogComponent {
  readonly confirm = inject(ConfirmService);
}
