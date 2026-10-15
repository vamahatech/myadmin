import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AdminContentService } from '../../../../core/services/admin-content.service';
import { Article } from '../../../../models/article.model';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe, PageHeaderComponent, StatusBadgeComponent, IconComponent],
  templateUrl: './admin-dashboard.component.html',
})
export class AdminDashboardComponent implements OnInit {
  private readonly admin = inject(AdminContentService);
  private readonly meta = inject(Meta);

  readonly articles = signal<Article[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');

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
}
