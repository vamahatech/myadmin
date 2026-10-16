import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../icon/icon.component';

/** Renders ToastService toasts, bottom-right (bottom-centre on phones). Mounted once in app.html. */
@Component({
  selector: 'app-toaster',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="fixed z-[200] bottom-4 left-4 right-4 sm:left-auto sm:w-[360px] flex flex-col gap-2 pointer-events-none" role="status" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-card shadow-md px-4 py-3 text-sm">
          <app-icon
            [name]="t.tone === 'error' ? 'alert-triangle' : t.tone === 'success' ? 'check-circle' : 'info'"
            [size]="18"
            class="mt-px"
            [class.text-success]="t.tone === 'success'"
            [class.text-danger]="t.tone === 'error'"
            [class.text-blue]="t.tone === 'info'" />
          <p class="flex-1 text-text">{{ t.message }}</p>
          <button type="button" class="icon-btn -m-1.5 w-8 h-8" (click)="toast.dismiss(t.id)" aria-label="Dismiss">
            <app-icon name="x" [size]="14" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toast { animation: toast-in 180ms ease-out; }
    @keyframes toast-in { from { opacity: 0; transform: translateY(8px); } }
    @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
  `,
})
export class ToasterComponent {
  readonly toast = inject(ToastService);
}
