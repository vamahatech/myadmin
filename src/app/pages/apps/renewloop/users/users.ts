import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, forkJoin } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { RenewloopAdminApi } from '../../../../core/services/renewloop/admin-api';
import { SortBy, SortDir, UserDetail, UserRow, UsersPage } from '../../../../core/models/renewloop/user.model';
import { ACTIVITY_LABELS, ActivityEntry, ActivityPage, activityDetail } from '../../../../core/models/renewloop/activity.model';
import { Modal } from '../../../../shared/components/modal/modal';
import { avatarColor, initials } from '../../../../shared/utils/avatar';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { IconComponent, IconName } from '../../../../shared/components/icon/icon.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';

type ActiveFilter = '' | 'true' | 'false';

const DAY = 24 * 60 * 60 * 1000;
// Newest-first sample used to count recent sign-ups (the API has no date filter).
const RECENT_SAMPLE = 100;

export interface UserStats {
  total: number;
  subscribed: number;
  unsubscribed: number;
  /** Sign-ups in the last 30 days / the 30 before; capped = sample ran out first. */
  new30: number;
  prev30: number;
  newCapped: boolean;
  prevCapped: boolean;
}


@Component({
  selector: 'app-renewloop-users',
  standalone: true,
  imports: [
    SkeletonComponent, DatePipe, DecimalPipe, FormsModule, PageHeaderComponent, IconComponent,
    EmptyStateComponent, PaginationComponent, Modal,
  ],
  templateUrl: './users.html',
})
export class RenewloopUsers {
  private api = inject(RenewloopAdminApi);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly page = signal<UsersPage | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly stats = signal<UserStats | null>(null);
  readonly panelUser = signal<UserRow | null>(null);
  readonly panelDetail = signal<UserDetail | null>(null);
  readonly panelActivity = signal<ActivityPage | null>(null);
  readonly panelError = signal(false);
  readonly statsFailed = signal(false);

  search = '';
  readonly sortBy = signal<SortBy>('createdAt');
  readonly sortDir = signal<SortDir>('desc');
  readonly activeFilter = signal<ActiveFilter>('');
  currentPage = 1;
  readonly pageSize = 20;

  readonly filters: { value: ActiveFilter; label: string }[] = [
    { value: '', label: 'All users' },
    { value: 'true', label: 'Subscribed' },
    { value: 'false', label: 'No subscription' },
  ];

  /** Selected rows, kept across pages/filters so a recipient list can be built up. */
  readonly selected = signal<Map<string, UserRow>>(new Map());
  readonly selectedUsers = computed(() => [...this.selected().values()]);
  readonly allOnPageSelected = computed(() => {
    const users = this.page()?.users ?? [];
    return users.length > 0 && users.every((u) => this.selected().has(u.id));
  });
  readonly someOnPageSelected = computed(
    () => !this.allOnPageSelected() && (this.page()?.users ?? []).some((u) => this.selected().has(u.id)),
  );

  // Search as you type (debounced) instead of a separate Search button.
  private readonly searchInput = new Subject<string>();

  constructor() {
    this.searchInput
      .pipe(debounceTime(300), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.reset());
    this.load();
    this.loadStats();
  }

  /** Header KPIs, independent of the table's search/filter. */
  loadStats(): void {
    forkJoin({
      all: this.api.getUsers({ limit: 1 }),
      subscribed: this.api.getUsers({ limit: 1, hasActiveSubscription: true }),
      unsubscribed: this.api.getUsers({ limit: 1, hasActiveSubscription: false }),
      recent: this.api.getUsers({ sortBy: 'createdAt', sortDir: 'desc', limit: RECENT_SAMPLE }),
    }).subscribe({
      next: ({ all, subscribed, unsubscribed, recent }) => {
        const now = Date.now();
        const ages = recent.users.map((u) => now - new Date(u.createdAt).getTime());
        // If every sampled user is inside a window, older ones may be missing.
        const exhausted = recent.users.length < recent.pagination.total;
        const oldest = ages.length ? Math.max(...ages) : 0;
        this.stats.set({
          total: all.pagination.total,
          subscribed: subscribed.pagination.total,
          unsubscribed: unsubscribed.pagination.total,
          new30: ages.filter((a) => a <= 30 * DAY).length,
          prev30: ages.filter((a) => a > 30 * DAY && a <= 60 * DAY).length,
          newCapped: exhausted && oldest <= 30 * DAY,
          prevCapped: exhausted && oldest <= 60 * DAY,
        });
      },
      error: () => this.statsFailed.set(true),
    });
  }

  share(n: number, of: number): number {
    return of ? (n / of) * 100 : 0;
  }

  /** % change of recent sign-ups vs the window before; null when not comparable. */
  newDelta(s: UserStats): number | null {
    if (s.newCapped || s.prevCapped || s.prev30 === 0) return null;
    return ((s.new30 - s.prev30) / s.prev30) * 100;
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const f = this.activeFilter();
    this.api
      .getUsers({
        search: this.search.trim() || undefined,
        sortBy: this.sortBy(),
        sortDir: this.sortDir(),
        hasActiveSubscription: f === '' ? undefined : f === 'true',
        page: this.currentPage,
        limit: this.pageSize,
      })
      .subscribe({
        next: (p) => {
          this.page.set(p);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Could not load users.');
          this.loading.set(false);
        },
      });
  }

  onSearchInput(value: string): void {
    this.search = value;
    this.searchInput.next(value);
  }

  setFilter(f: ActiveFilter): void {
    this.activeFilter.set(f);
    this.reset();
  }

  /** Column header click: same column flips direction, a new column starts desc (name: asc). */
  sort(by: SortBy): void {
    if (this.sortBy() === by) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(by);
      this.sortDir.set(by === 'name' ? 'asc' : 'desc');
    }
    this.reset();
  }

  sortIcon(by: SortBy): IconName {
    if (this.sortBy() !== by) return 'chevrons-up-down';
    return this.sortDir() === 'asc' ? 'arrow-up' : 'arrow-down';
  }

  toggle(u: UserRow): void {
    const next = new Map(this.selected());
    if (next.has(u.id)) next.delete(u.id);
    else next.set(u.id, u);
    this.selected.set(next);
  }

  togglePage(): void {
    const users = this.page()?.users ?? [];
    const next = new Map(this.selected());
    if (this.allOnPageSelected()) users.forEach((u) => next.delete(u.id));
    else users.forEach((u) => next.set(u.id, u));
    this.selected.set(next);
  }

  clearSelection(): void {
    this.selected.set(new Map());
  }

  /** Opens the composer with these users pre-picked (none = composer as-is). */
  notify(users: UserRow[]): void {
    this.router.navigate(['../notifications'], {
      relativeTo: this.route,
      state: users.length ? { recipients: users } : undefined,
    });
  }

  readonly initials = initials;
  readonly avatarColor = avatarColor;
  readonly activityLabel = (e: ActivityEntry) => ACTIVITY_LABELS[e.event] ?? e.event;
  readonly activityDetail = activityDetail;

  /** User panel: profile, devices and recent activity for one row. */
  openUser(u: UserRow): void {
    this.panelUser.set(u);
    this.panelDetail.set(null);
    this.panelActivity.set(null);
    this.panelError.set(false);
    this.api.getUser(u.id).subscribe({
      next: (d) => this.panelDetail.set(d),
      error: () => this.panelError.set(true),
    });
    this.api.getActivity({ userId: u.id, limit: 8 }).subscribe({
      next: (p) => this.panelActivity.set(p),
      error: () => this.panelError.set(true),
    });
  }

  closeUser(): void {
    this.panelUser.set(null);
  }

  viewAllActivity(u: UserRow): void {
    this.router.navigate(['../activity'], { relativeTo: this.route, queryParams: { userId: u.id } });
  }

  ariaSort(by: SortBy): 'ascending' | 'descending' | 'none' {
    if (this.sortBy() !== by) return 'none';
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }

  clearFilters(): void {
    this.search = '';
    this.activeFilter.set('');
    this.reset();
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
