import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Label for the confirming button. Default "Confirm". */
  confirmLabel?: string;
  /** 'danger' for destructive actions (red button). Default 'primary'. */
  tone?: 'primary' | 'danger';
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

/**
 * Promise-based replacement for window.confirm(), rendered by the single
 * <app-confirm-dialog> in app.html so every app gets the same styled,
 * keyboard-accessible dialog:
 *
 *   if (!(await this.confirm.ask({ title: 'Publish article?', message: '…' }))) return;
 *
 * For irreversible deletes keep using <app-confirm-delete-modal> (type-to-confirm).
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly pending = signal<PendingConfirm | null>(null);

  ask(options: ConfirmOptions): Promise<boolean> {
    // A second ask while one is open resolves the first as cancelled.
    this.pending()?.resolve(false);
    return new Promise<boolean>(resolve => this.pending.set({ ...options, resolve }));
  }

  settle(ok: boolean): void {
    const p = this.pending();
    if (!p) return;
    this.pending.set(null);
    p.resolve(ok);
  }
}
