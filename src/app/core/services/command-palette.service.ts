import { Injectable, signal } from '@angular/core';

/** Open/close state for the ⌘K command palette (rendered once in app.html). */
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  readonly open = signal(false);

  show(): void { this.open.set(true); }
  hide(): void { this.open.set(false); }
  toggle(): void { this.open.update(v => !v); }
}
