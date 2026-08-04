import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AuthService } from '../../../../core/services/auth.service';
import { AdminContentService } from '../../../../core/services/admin-content.service';
import { Article } from '../../../../models/article.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './admin-dashboard.component.html',
})
export class AdminDashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly admin = inject(AdminContentService);
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);

  readonly articles = signal<Article[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');

  topic = '';
  sourcesText = '';
  category = 'update';
  guidance = '';
  readonly genStatus = signal<'idle' | 'running' | 'error'>('idle');
  readonly genError = signal('');

  newTitle = '';
  readonly newStatus = signal<'idle' | 'creating' | 'error'>('idle');
  readonly newError = signal('');

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

  generate(): void {
    if (this.genStatus() === 'running') return;
    const sources = this.parseSources();
    if (!this.topic.trim() || sources.length === 0) {
      this.genStatus.set('error');
      this.genError.set('Add a topic and at least one source URL.');
      return;
    }
    this.genStatus.set('running');
    this.genError.set('');
    this.admin
      .generateDraft({
        topic: this.topic.trim(),
        sources,
        category: this.category.trim() || 'update',
        guidance: this.guidance.trim() || undefined,
      })
      .subscribe({
        next: (draft) => {
          this.articles.update((list) => [draft, ...list]);
          this.resetForm();
          this.genStatus.set('idle');
          void this.router.navigate(['/apps/vamaha/articles', draft.id]);
        },
        error: (err: unknown) => {
          this.genStatus.set('error');
          this.genError.set(this.messageFor(err));
        },
      });
  }

  /** Create a blank draft and jump straight into the editor to write it by hand. */
  writeNew(): void {
    if (this.newStatus() === 'creating') return;
    const title = this.newTitle.trim();
    if (title.length < 2) {
      this.newStatus.set('error');
      this.newError.set('Give the article a title to start.');
      return;
    }
    this.newStatus.set('creating');
    this.newError.set('');
    this.admin
      .create({
        slug: this.slugify(title),
        title,
        excerpt: 'Draft — add a one-line summary before publishing.',
        bodyMd: `# ${title}\n\nStart writing here…`,
        author: this.auth.user()?.name || 'Vamaha Editorial',
        category: 'update',
      })
      .subscribe({
        next: (draft) => {
          this.newTitle = '';
          this.newStatus.set('idle');
          void this.router.navigate(['/apps/vamaha/articles', draft.id]);
        },
        error: (err: unknown) => {
          this.newStatus.set('error');
          this.newError.set(this.messageFor(err));
        },
      });
  }

  private slugify(title: string): string {
    const base = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);
    return `${base || 'article'}-${Date.now().toString(36).slice(-4)}`;
  }

  private parseSources(): string[] {
    return this.sourcesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private resetForm(): void {
    this.topic = '';
    this.sourcesText = '';
    this.guidance = '';
    this.category = 'update';
  }

  private messageFor(err: unknown): string {
    const status = (err as { status?: number })?.status;
    if (status === 503) return 'Draft generation is not configured on the server (missing API key).';
    if (status === 422) return 'Could not draft from those sources. Check the URLs or revise the topic.';
    if (status === 401) return 'Your session expired. Please sign in again.';
    return 'Generation failed. Please try again.';
  }
}
