import { Component, effect, inject, signal } from '@angular/core';
import { LoadingService } from '../../../core/services/loading.service';

const SHOW_DELAY_MS = 150;
const MIN_VISIBLE_MS = 300;

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  templateUrl: './loading-overlay.component.html',
})
export class LoadingOverlayComponent {
  private readonly loading = inject(LoadingService);
  readonly visible = signal(false);

  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private shownAt = 0;

  constructor() {
    effect(() => {
      const isLoading = this.loading.isLoading();
      if (isLoading) {
        this.cancelHide();
        if (!this.visible() && !this.showTimer) {
          this.showTimer = setTimeout(() => {
            this.showTimer = null;
            this.shownAt = Date.now();
            this.visible.set(true);
          }, SHOW_DELAY_MS);
        }
      } else {
        this.cancelShow();
        if (this.visible()) {
          const elapsed = Date.now() - this.shownAt;
          const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
          this.hideTimer = setTimeout(() => {
            this.hideTimer = null;
            this.visible.set(false);
          }, remaining);
        }
      }
    });
  }

  private cancelShow(): void {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
  }

  private cancelHide(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}
