import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon/icon.component';
import { ShellContext } from '../app-shell/shell-context';

export interface Crumb {
  label: string;
  /** Omit on the last crumb (the current page). */
  link?: string;
}

/**
 * Standard page heading: breadcrumb, title + description on the left, page
 * actions (projected) on the right; wraps under the title on narrow screens.
 *
 * Inside an app shell the breadcrumb defaults to "App › Module › Page" (from
 * ShellContext); pass [breadcrumb] only to override it. For a description
 * that needs markup, project it instead of using the input:
 *
 *   <app-page-header title="Articles" description="…">
 *     <button class="btn btn-secondary">Refresh</button>
 *   </app-page-header>
 *
 *   <app-page-header title="Ingest review">
 *     <span pageDescription>Leads from the <code>ingest</code> tool.</span>
 *   </app-page-header>
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    @if (crumbs().length) {
      <nav aria-label="Breadcrumb" class="mb-2">
        <ol class="flex flex-wrap items-center gap-1 text-xs leading-[18px] text-text2">
          @for (c of crumbs(); track $index; let last = $last) {
            <li class="flex items-center gap-1">
              @if (c.link && !last) {
                <a [routerLink]="c.link" class="rounded text-text2 no-underline hover:text-text hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">{{ c.label }}</a>
              } @else {
                <span [attr.aria-current]="last ? 'page' : null" [class.text-text]="last" [class.font-medium]="last">{{ c.label }}</span>
              }
              @if (!last) {
                <app-icon name="chevron-right" [size]="12" />
              }
            </li>
          }
        </ol>
      </nav>
    }
    <div class="page-head">
      <div class="min-w-0">
        <h1>{{ title() }}</h1>
        @if (description()) {
          <p class="muted">{{ description() }}</p>
        }
        <p class="muted page-head__desc"><ng-content select="[pageDescription]" /></p>
      </div>
      <div class="page-head__actions">
        <ng-content />
      </div>
    </div>
  `,
  host: { class: 'block' },
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input<string>();
  /** Overrides the shell's default breadcrumb. [] inside a shell = default. */
  readonly breadcrumb = input<Crumb[]>([]);

  private readonly shell = inject(ShellContext, { optional: true });

  readonly crumbs = computed<Crumb[]>(() => {
    const explicit = this.breadcrumb();
    if (explicit.length || !this.shell) return explicit;
    const out: Crumb[] = [{ label: this.shell.appName, link: this.shell.basePath }];
    // The module crumb only adds information on pages *below* a module
    // (e.g. Articles › New article); on the module's own page it's redundant.
    const item = this.shell.activeItem();
    const path = this.shell.url().split(/[?#]/)[0];
    if (item && path !== this.shell.link(item)) out.push({ label: item.label, link: this.shell.link(item) });
    out.push({ label: this.title() });
    return out;
  });
}
