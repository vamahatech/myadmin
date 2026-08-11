import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe, LowerCasePipe } from '@angular/common';
import { Meta } from '@angular/platform-browser';
import { FeedbackService } from '../../../../core/services/feedback.service';
import { FeedbackRow, FeedbackStatus } from '../../../../models/feedback.model';

const APP_SLUG = 'emi-planner';

@Component({
  selector: 'app-emi-feedback',
  standalone: true,
  imports: [DatePipe, LowerCasePipe],
  templateUrl: './feedback.component.html',
})
export class FeedbackComponent implements OnInit {
  private readonly feedback = inject(FeedbackService);
  private readonly meta = inject(Meta);

  readonly items = signal<FeedbackRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly statusFilter = signal<FeedbackStatus | ''>('');

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    const status = this.statusFilter();
    this.feedback
      .findAll({ app: APP_SLUG, status: status || undefined, limit: 50 })
      .subscribe({
        next: (page) => {
          this.items.set(page.items);
          this.total.set(page.meta.total);
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set('Could not load feedback.');
          this.loading.set(false);
        },
      });
  }

  setStatusFilter(status: FeedbackStatus | ''): void {
    this.statusFilter.set(status);
    this.load();
  }

  mark(id: string, status: FeedbackStatus): void {
    this.feedback.updateStatus(id, status).subscribe({
      next: () => this.load(),
      error: () => this.loadError.set('Could not update feedback status.'),
    });
  }

  initial(row: FeedbackRow): string {
    return (row.name?.trim()?.[0] ?? row.email?.trim()?.[0] ?? '?').toUpperCase();
  }

  stars(rating: number | null): number[] {
    return rating ? Array.from({ length: 5 }, (_, i) => i) : [];
  }
}
