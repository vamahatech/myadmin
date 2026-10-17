import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { RenewloopAdminApi } from '../../../../core/services/renewloop/admin-api';
import { ToastService } from '../../../../core/services/toast.service';
import { findApp } from '../../../../core/models/app-registry.model';
import {
  ERROR_KIND_LABELS, ERROR_STATUS_LABELS, ErrorIssue, ErrorKind, ErrorSource, ErrorStatus, ErrorsPage, statusTone,
} from '../../../../core/models/renewloop/support.model';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { Modal } from '../../../../shared/components/modal/modal';
import { PermissionService } from '../../../../core/services/permission.service';

type StatusFilter = ErrorStatus | 'open' | '';

@Component({
  selector: 'app-renewloop-errors',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FormsModule, PageHeaderComponent, SkeletonComponent, IconComponent,
    EmptyStateComponent, PaginationComponent, Modal,
  ],
  templateUrl: './errors.html',
})
export class RenewloopErrors {
  private api = inject(RenewloopAdminApi);
  private toast = inject(ToastService);

  /** Native crashes / ANRs live in Play Console (Android vitals), not here. */
  readonly crashConsoleUrl = findApp('renewloop')?.crashConsoleUrl ?? null;

  readonly page = signal<ErrorsPage | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly status = signal<StatusFilter>('open');
  readonly source = signal<ErrorSource | ''>('');
  readonly kind = signal<ErrorKind | ''>('');
  currentPage = 1;
  readonly pageSize = 20;

  readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'open', label: 'Open (new + investigating)' },
    { value: '', label: 'All statuses' },
    ...(Object.entries(ERROR_STATUS_LABELS) as [ErrorStatus, string][]).map(([value, label]) => ({ value, label })),
  ];
  readonly kindOptions = (Object.entries(ERROR_KIND_LABELS) as [ErrorKind, string][]).map(([value, label]) => ({ value, label }));
  readonly editStatuses = Object.entries(ERROR_STATUS_LABELS) as [ErrorStatus, string][];

  readonly selected = signal<ErrorIssue | null>(null);
  editStatus: ErrorStatus = 'new';
  editNote = '';
  readonly saving = signal(false);
  /** Changing status/notes needs the Editor role; viewers see the details read-only. */
  readonly canEdit = computed(() => this.perms.can('renewloop', 'errors', 'edit'));
  private readonly perms = inject(PermissionService);

  readonly tone = statusTone;
  readonly statusLabel = (s: ErrorStatus) => ERROR_STATUS_LABELS[s] ?? s;
  readonly kindLabel = (k: ErrorKind) => ERROR_KIND_LABELS[k] ?? k;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getErrors({
        status: this.status() || undefined,
        source: this.source() || undefined,
        kind: this.kind() || undefined,
        page: this.currentPage,
        limit: this.pageSize,
      })
      .subscribe({
        next: (p) => {
          this.page.set(p);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Could not load errors.');
          this.loading.set(false);
        },
      });
  }

  setStatus(v: string): void {
    this.status.set(v as StatusFilter);
    this.reset();
  }

  setSource(v: string): void {
    this.source.set(v as ErrorSource | '');
    this.reset();
  }

  setKind(v: string): void {
    this.kind.set(v as ErrorKind | '');
    this.reset();
  }

  clearFilters(): void {
    this.status.set('');
    this.source.set('');
    this.kind.set('');
    this.reset();
  }

  goToPage(p: number): void {
    this.currentPage = p;
    this.load();
  }

  open(issue: ErrorIssue): void {
    this.selected.set(issue);
    this.editStatus = issue.status;
    this.editNote = issue.note ?? '';
  }

  close(): void {
    this.selected.set(null);
  }

  save(): void {
    const issue = this.selected();
    if (!issue) return;
    this.saving.set(true);
    this.api.updateError(issue.id, { status: this.editStatus, note: this.editNote.trim() || null }).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.toast.success(`Marked as ${this.statusLabel(updated.status).toLowerCase()}.`);
        this.selected.set(null);
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(e?.error?.errors?.[0] ?? 'Could not update this issue.');
      },
    });
  }

  /** "0.0.13, 0.0.12 +2": newest two versions first. */
  versions(issue: ErrorIssue): string {
    const v = [...issue.appVersions].reverse();
    if (!v.length) return '—';
    return v.slice(0, 2).join(', ') + (v.length > 2 ? ` +${v.length - 2}` : '');
  }

  title(issue: ErrorIssue): string {
    return issue.name || this.kindLabel(issue.kind);
  }

  private reset(): void {
    this.currentPage = 1;
    this.load();
  }
}
