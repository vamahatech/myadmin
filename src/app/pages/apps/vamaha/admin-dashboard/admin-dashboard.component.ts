import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AdminContentService } from '../../../../core/services/admin-content.service';
import { Article } from '../../../../models/article.model';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PermissionService } from '../../../../core/services/permission.service';

type StatusFilter = 'ALL' | Article['status'];

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [EmptyStateComponent, SkeletonComponent, RouterLink, DatePipe, PageHeaderComponent, StatusBadgeComponent, IconComponent],
  templateUrl: './admin-dashboard.component.html',
})
export class AdminDashboardComponent implements OnInit {
  /** Creating/editing articles needs the Editor role on Vamaha. */
  readonly canEdit = inject(PermissionService).can('vamaha', 'articles', 'edit');

  private readonly admin = inject(AdminContentService);
  private readonly meta = inject(Meta);

  readonly articles = signal<Article[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');

  readonly status = signal<StatusFilter>('ALL');
  readonly query = signal('');

  readonly counts = computed(() => {
    const list = this.articles();
    const by = (s: Article['status']) => list.filter(a => a.status === s).length;
    return { ALL: list.length, PUBLISHED: by('PUBLISHED'), DRAFT: by('DRAFT'), IN_REVIEW: by('IN_REVIEW') };
  });

  readonly filters: { id: StatusFilter; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'PUBLISHED', label: 'Published' },
    { id: 'DRAFT', label: 'Drafts' },
    { id: 'IN_REVIEW', label: 'In review' },
  ];

  readonly visible = computed(() => {
    const s = this.status();
    const q = this.query().trim().toLowerCase();
    return this.articles()
      .filter(a => s === 'ALL' || a.status === s)
      .filter(a => !q || a.title.toLowerCase().includes(q) || a.slug.toLowerCase().includes(q));
  });

  readonly lastUpdated = computed(() => {
    const times = this.articles().map(a => a.updatedAt).sort();
    return times.length ? times[times.length - 1] : null;
  });

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    this.loadArticles();
  }

  loadArticles(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.admin.listAll().subscribe({
      next: (list) => {
        this.articles.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load articles.');
        this.loading.set(false);
      },
    });
  }

  onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  clearFilters(): void {
    this.status.set('ALL');
    this.query.set('');
  }
}
