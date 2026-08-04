import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { AdminApi } from '../../../../core/services/verdiq/admin-api';
import { GapsReport } from '../../../../core/models/verdiq/coverage.model';

// Coverage & gaps — the "what needs to be added next" view. Surfaces the
// backfill worklist (missing nutrition), per-category scoreable coverage, and
// how thin the enrichment tables (double-standards, alternatives, additives) are.
@Component({
  selector: 'app-coverage',
  imports: [DecimalPipe],
  templateUrl: './coverage.html',
  styleUrl: './coverage.sass',
})
export class Coverage {
  private api = inject(AdminApi);

  readonly report = signal<GapsReport | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getGaps().subscribe({
      next: (r) => {
        this.report.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load gaps report.');
        this.loading.set(false);
      },
    });
  }
}
