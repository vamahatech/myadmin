import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AdminContentService } from '../../../../core/services/admin-content.service';
import { Article } from '../../../../models/article.model';
import { MarkdownEditorComponent } from '../../../../shared/components/markdown-editor/markdown-editor.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-admin-article',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, MarkdownEditorComponent],
  templateUrl: './admin-article.component.html',
})
export class AdminArticleComponent implements OnInit {
  private readonly admin = inject(AdminContentService);
  private readonly route = inject(ActivatedRoute);
  private readonly meta = inject(Meta);

  readonly siteUrl = environment.siteUrl;

  private id = '';
  readonly article = signal<Article | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal('');

  readonly lang = signal<'en' | 'te'>('en');

  title = '';
  excerpt = '';
  bodyMd = '';
  titleTe = '';
  excerptTe = '';
  bodyMdTe = '';
  seoTitle = '';
  seoDescription = '';

  readonly saveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  readonly publishStatus = signal<'idle' | 'publishing' | 'error'>('idle');
  readonly actionError = signal('');

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.admin.getOne(this.id).subscribe({
      next: (a) => {
        this.apply(a);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load this article.');
        this.loading.set(false);
      },
    });
  }

  save(): void {
    if (this.saveStatus() === 'saving') return;
    this.saveStatus.set('saving');
    this.actionError.set('');
    this.admin
      .update(this.id, {
        title: this.title.trim(),
        excerpt: this.excerpt.trim(),
        bodyMd: this.bodyMd,
        titleTe: this.titleTe.trim() || null,
        excerptTe: this.excerptTe.trim() || null,
        bodyMdTe: this.bodyMdTe.trim() || null,
        seoTitle: this.seoTitle.trim() || null,
        seoDescription: this.seoDescription.trim() || null,
      })
      .subscribe({
        next: (a) => {
          this.apply(a);
          this.saveStatus.set('saved');
        },
        error: (err: unknown) => {
          this.saveStatus.set('error');
          this.actionError.set(this.messageFor(err));
        },
      });
  }

  publish(): void {
    if (this.publishStatus() === 'publishing') return;
    if (!confirm('Publish this article? It will go live on the site.')) return;
    this.publishStatus.set('publishing');
    this.actionError.set('');
    this.admin.publish(this.id).subscribe({
      next: (a) => {
        this.apply(a);
        this.publishStatus.set('idle');
      },
      error: (err: unknown) => {
        this.publishStatus.set('error');
        this.actionError.set(this.messageFor(err));
      },
    });
  }

  private apply(a: Article): void {
    this.article.set(a);
    this.title = a.title;
    this.excerpt = a.excerpt;
    this.bodyMd = a.bodyMd;
    this.titleTe = a.titleTe ?? '';
    this.excerptTe = a.excerptTe ?? '';
    this.bodyMdTe = a.bodyMdTe ?? '';
    this.seoTitle = a.seoTitle ?? '';
    this.seoDescription = a.seoDescription ?? '';
  }

  private messageFor(err: unknown): string {
    const status = (err as { status?: number })?.status;
    if (status === 401) return 'Your session expired. Please sign in again.';
    return 'Action failed. Please try again.';
  }
}
