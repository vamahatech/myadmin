import { Component, DestroyRef, inject, signal, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { Subject, debounceTime } from 'rxjs';
import { AdminContentService } from '../../../../core/services/admin-content.service';
import { Article } from '../../../../models/article.model';
import { MarkdownEditorComponent } from '../../../../shared/components/markdown-editor/markdown-editor.component';
import { PublishPanelComponent } from '../../../../shared/components/publish-panel/publish-panel.component';
import { environment } from '../../../../../environments/environment';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';

const AUTOSAVE_DEBOUNCE_MS = 2000;

@Component({
  selector: 'app-admin-article',
  standalone: true,
  imports: [SkeletonComponent, FormsModule, RouterLink, MarkdownEditorComponent, PublishPanelComponent, StatusBadgeComponent, IconComponent],
  templateUrl: './admin-article.component.html',
})
export class AdminArticleComponent implements OnInit {
  private readonly admin = inject(AdminContentService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly meta = inject(Meta);
  private readonly destroyRef = inject(DestroyRef);

  readonly siteUrl = environment.siteUrl;

  private id = '';
  readonly article = signal<Article | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal('');

  readonly lang = signal<'en' | 'te'>('en');
  readonly panelOpen = signal(false);

  title = '';
  excerpt = '';
  bodyMd = '';
  titleTe = '';
  excerptTe = '';
  bodyMdTe = '';
  seoTitle = '';
  seoDescription = '';
  category = 'update';

  readonly autosaveStatus = signal<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  readonly publishStatus = signal<'idle' | 'publishing' | 'error'>('idle');
  readonly actionError = signal('');

  private readonly dirty$ = new Subject<void>();

  constructor() {
    this.dirty$.pipe(debounceTime(AUTOSAVE_DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.save();
    });
  }

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  markDirty(): void {
    this.autosaveStatus.set('dirty');
    this.dirty$.next();
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
    if (this.autosaveStatus() === 'saving') return;
    this.autosaveStatus.set('saving');
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
        category: this.category.trim() || 'update',
      })
      .subscribe({
        next: (a) => {
          this.apply(a);
          this.autosaveStatus.set('saved');
        },
        error: (err: unknown) => {
          this.autosaveStatus.set('error');
          this.actionError.set(this.messageFor(err));
        },
      });
  }

  async publish(): Promise<void> {
    if (this.publishStatus() === 'publishing') return;
    if (!(await this.confirm.ask({ title: 'Publish article?', message: 'It will go live on the site and in the app.', confirmLabel: 'Publish' }))) return;
    this.publishStatus.set('publishing');
    this.actionError.set('');
    this.admin.publish(this.id).subscribe({
      next: (a) => {
        this.apply(a);
        this.publishStatus.set('idle');
        this.panelOpen.set(false);
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
    this.category = a.category;
  }

  private messageFor(err: unknown): string {
    const status = (err as { status?: number })?.status;
    if (status === 401) return 'Your session expired. Please sign in again.';
    return 'Action failed. Please try again.';
  }
}
