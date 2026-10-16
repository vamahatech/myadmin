import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { RenewloopAdminApi } from '../../../../core/services/renewloop/admin-api';
import {
  ACTIVITY_LABELS, ActivityEntry, ActivityEvent, ActivityPage, activityDetail,
} from '../../../../core/models/renewloop/activity.model';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { avatarColor, initials } from '../../../../shared/utils/avatar';

type Range = '' | '1' | '7' | '30';

@Component({
  selector: 'app-renewloop-activity',
  standalone: true,
  imports: [DatePipe, PageHeaderComponent, SkeletonComponent, IconComponent, EmptyStateComponent, PaginationComponent],
  templateUrl: './activity.html',
})
export class RenewloopActivity {
  private api = inject(RenewloopAdminApi);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly page = signal<ActivityPage | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly event = signal<ActivityEvent | ''>('');
  readonly range = signal<Range>('');
  /** Set from ?userId= (the Users page "View all activity" link). */
  readonly userId = signal<string | null>(null);
  readonly userName = signal<string | null>(null);
  currentPage = 1;
  readonly pageSize = 20;

  readonly events = Object.entries(ACTIVITY_LABELS).map(([value, label]) => ({ value: value as ActivityEvent, label }));
  readonly ranges: { value: Range; label: string }[] = [
    { value: '', label: 'All time' },
    { value: '1', label: 'Last 24 hours' },
    { value: '7', label: 'Last 7 days' },
    { value: '30', label: 'Last 30 days' },
  ];

  readonly initials = initials;
  readonly avatarColor = avatarColor;
  readonly detail = activityDetail;
  label(e: ActivityEntry): string {
    return ACTIVITY_LABELS[e.event] ?? e.event;
  }

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((q) => {
      const id = q.get('userId');
      this.userId.set(id);
      this.userName.set(null);
      if (id) {
        this.api.getUser(id).subscribe({
          next: (u) => this.userName.set(u.name),
          error: () => this.userName.set('Unknown user'),
        });
      }
      this.reset();
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const days = Number(this.range());
    this.api
      .getActivity({
        userId: this.userId() ?? undefined,
        event: this.event() || undefined,
        from: days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : undefined,
        page: this.currentPage,
        limit: this.pageSize,
      })
      .subscribe({
        next: (p) => {
          this.page.set(p);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Could not load activity.');
          this.loading.set(false);
        },
      });
  }

  setEvent(value: string): void {
    this.event.set(value as ActivityEvent | '');
    this.reset();
  }

  setRange(value: string): void {
    this.range.set(value as Range);
    this.reset();
  }

  clearUser(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { userId: null }, queryParamsHandling: 'merge' });
  }

  showUser(id: string): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { userId: id } });
  }

  clearFilters(): void {
    this.event.set('');
    this.range.set('');
    if (this.userId()) this.clearUser();
    else this.reset();
  }

  goToPage(p: number): void {
    this.currentPage = p;
    this.load();
  }

  private reset(): void {
    this.currentPage = 1;
    this.load();
  }
}
