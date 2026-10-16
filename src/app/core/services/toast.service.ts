import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

/**
 * Transient confirmations ("Saved", "Broadcast sent to 12 devices") shown by
 * the single <app-toaster> in app.html. Errors that block the page should
 * stay inline (.state.error); use toasts for the outcome of an action.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 0;

  success(message: string): void { this.show(message, 'success'); }
  error(message: string): void { this.show(message, 'error', 6000); }
  info(message: string): void { this.show(message, 'info'); }

  dismiss(id: number): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  private show(message: string, tone: Toast['tone'], ms = 4000): void {
    const id = this.nextId++;
    // Keep at most 3 on screen.
    this.toasts.update(list => [...list.slice(-2), { id, message, tone }]);
    setTimeout(() => this.dismiss(id), ms);
  }
}
