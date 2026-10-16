import { Injectable, signal } from '@angular/core';

export type ThemePref = 'light' | 'dark' | 'system';

/** Same key the pre-boot script in index.html reads, so there's no flash. */
export const THEME_STORAGE_KEY = 'vamaha_admin_theme';

/**
 * Light / dark / follow-system theme. Applies by toggling `html.dark`, which
 * is what src/styles/colors.css keys the dark tokens on.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');
  readonly pref = signal<ThemePref>(this.read());

  constructor() {
    this.apply();
    // Follow OS changes live while the preference is 'system'.
    this.media.addEventListener('change', () => {
      if (this.pref() === 'system') this.apply();
    });
  }

  set(pref: ThemePref): void {
    this.pref.set(pref);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, pref);
    } catch {
      /* storage blocked — preference just won't persist */
    }
    this.apply();
  }

  private apply(): void {
    const dark = this.pref() === 'dark' || (this.pref() === 'system' && this.media.matches);
    document.documentElement.classList.toggle('dark', dark);
  }

  private read(): ThemePref {
    try {
      const v = localStorage.getItem(THEME_STORAGE_KEY);
      if (v === 'light' || v === 'dark' || v === 'system') return v;
    } catch {
      /* ignore */
    }
    return 'system';
  }
}
