import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import { RenewloopAdminApi } from '../../../../core/services/renewloop/admin-api';
import {
  ACTIVITY_LABELS, ActivityEntry, ActivityEvent, ActivityPage, activityDetail,
} from '../../../../core/models/renewloop/activity.model';
import { UserDetail, UserRow } from '../../../../core/models/renewloop/user.model';
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
  styles: `
    .user-results {
      position: absolute;
      z-index: 30;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      max-height: 320px;
      overflow-y: auto;
      padding: 4px;
      border: 1px solid var(--color-border);
      border-radius: 10px;
      background: var(--color-card);
      box-shadow: 0 8px 24px color-mix(in srgb, var(--color-text) 12%, transparent);
    }
    .user-results [role='option'] {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 8px;
      border-radius: 8px;
      cursor: pointer;
    }
    .user-results [role='option']:hover,
    .user-results [role='option'].is-active {
      background: var(--color-hover);
    }
  `,
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
  /** Focused user, from ?userId= (picker below, or the Users page "View all activity"). */
  readonly userId = signal<string | null>(null);
  readonly focused = signal<UserDetail | null>(null);
  readonly focusedError = signal(false);

  // User picker (combobox): search by name/email, pick one to focus the log.
  readonly userTerm = signal('');
  readonly userResults = signal<UserRow[]>([]);
  readonly userSearching = signal(false);
  readonly pickerOpen = signal(false);
  readonly activeIndex = signal(-1);
  private readonly userSearch$ = new Subject<string>();
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
  deviceList(u: UserDetail): string {
    return u.devices.map((d) => d.label).join(', ');
  }

  /** Which console admin did it (recorded since signed sessions); older entries just say Admin. */
  adminName(e: ActivityEntry): string {
    const name = e.details['actorName'] ?? e.details['actorEmail'];
    return typeof name === 'string' && name ? name : 'Admin';
  }

  label(e: ActivityEntry): string {
    return ACTIVITY_LABELS[e.event] ?? e.event;
  }

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.route.queryParamMap.pipe(takeUntilDestroyed(destroyRef)).subscribe((q) => {
      const id = q.get('userId');
      if (id === this.userId() && this.page()) return;
      this.userId.set(id);
      this.focused.set(null);
      this.focusedError.set(false);
      if (id) {
        this.api.getUser(id).subscribe({
          next: (u) => this.focused.set(u),
          error: () => this.focusedError.set(true),
        });
      }
      this.reset();
    });

    this.userSearch$
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(destroyRef))
      .subscribe((term) => this.searchUsers(term));
  }

  onUserInput(term: string): void {
    this.userTerm.set(term);
    this.pickerOpen.set(true);
    this.activeIndex.set(-1);
    this.userSearch$.next(term.trim());
  }

  private searchUsers(term: string): void {
    if (!term) {
      this.userResults.set([]);
      this.userSearching.set(false);
      return;
    }
    this.userSearching.set(true);
    this.api.getUsers({ search: term, limit: 8 }).subscribe({
      next: (p) => {
        // Ignore a response for a term the user has typed past.
        if (term !== this.userTerm().trim()) return;
        this.userResults.set(p.users);
        this.userSearching.set(false);
      },
      error: () => this.userSearching.set(false),
    });
  }

  onUserKeydown(ev: KeyboardEvent): void {
    const n = this.userResults().length;
    if (ev.key === 'ArrowDown' && n) {
      ev.preventDefault();
      this.pickerOpen.set(true);
      this.activeIndex.set((this.activeIndex() + 1) % n);
    } else if (ev.key === 'ArrowUp' && n) {
      ev.preventDefault();
      this.activeIndex.set((this.activeIndex() - 1 + n) % n);
    } else if (ev.key === 'Enter') {
      const u = this.userResults()[this.activeIndex() >= 0 ? this.activeIndex() : 0];
      if (u && this.pickerOpen()) {
        ev.preventDefault();
        this.pickUser(u);
      }
    } else if (ev.key === 'Escape') {
      this.pickerOpen.set(false);
    }
  }

  /** Delay so a click on a result lands before the list closes. */
  onUserBlur(): void {
    setTimeout(() => this.pickerOpen.set(false), 150);
  }

  pickUser(u: UserRow): void {
    this.userTerm.set('');
    this.userResults.set([]);
    this.pickerOpen.set(false);
    this.showUser(u.id);
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
