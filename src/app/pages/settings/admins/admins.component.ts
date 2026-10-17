import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { Observable } from 'rxjs';

import { AdminsService } from '../../../core/services/admins.service';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { APP_REGISTRY, AppNavItem } from '../../../core/models/app-registry.model';
import { APP_ROLE_HINTS, APP_ROLE_LABELS, AppRole } from '../../../core/models/permissions.model';
import {
  AUDIT_ACTION_LABELS, AccessGrant, AdminAccount, AdminRole, AuditPage,
} from '../../../core/models/admin-account.model';
import { navModule } from '../../../core/services/permission.service';
import { GlobalHeaderComponent } from '../../../shared/components/global-header/global-header.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { Modal } from '../../../shared/components/modal/modal';
import { avatarColor, initials } from '../../../shared/utils/avatar';

type Tab = 'admins' | 'audit';

/** Per-app row in the access editor. role '' = no access. */
interface DraftGrant {
  role: AppRole | '';
  /** Ticked modules; all ticked = every module (stored as []). */
  modules: string[];
}

interface Draft {
  id: string | null;
  name: string;
  email: string;
  role: AdminRole;
  grants: Record<string, DraftGrant>;
}

@Component({
  selector: 'app-admins',
  standalone: true,
  imports: [
    DatePipe, FormsModule, RouterLink, GlobalHeaderComponent, PageHeaderComponent, IconComponent,
    SkeletonComponent, EmptyStateComponent, PaginationComponent, Modal,
  ],
  templateUrl: './admins.component.html',
})
export class AdminsComponent implements OnInit {
  private readonly api = inject(AdminsService);
  private readonly auth = inject(AuthService);
  private readonly perms = inject(PermissionService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);

  readonly tab = signal<Tab>('admins');
  readonly admins = signal<AdminAccount[] | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);

  readonly roleLabels = APP_ROLE_LABELS;
  readonly roleHints = APP_ROLE_HINTS;
  readonly appRoles: AppRole[] = ['VIEWER', 'EDITOR', 'MANAGER'];
  readonly initials = initials;
  readonly avatarColor = avatarColor;
  readonly meId = computed(() => this.auth.user()?.id ?? null);

  /** Apps with their module ids (from the server catalog) and sidebar labels. */
  readonly apps = computed(() => {
    const catalog = this.perms.permissions()?.catalog ?? {};
    const labels = moduleLabels(this.router.config);
    return APP_REGISTRY.filter((a) => catalog[a.id]).map((a) => ({
      id: a.id,
      name: a.name,
      icon: a.icon,
      modules: catalog[a.id].map((m) => ({ id: m, label: labels[a.id]?.[m] ?? m })),
    }));
  });

  readonly counts = computed(() => {
    const list = this.admins() ?? [];
    return {
      total: list.length,
      active: list.filter((a) => a.status === 'active').length,
      invited: list.filter((a) => a.status === 'invited').length,
    };
  });

  // ── Invite / edit dialog
  readonly draft = signal<Draft | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');
  /** Shown after an invite when the server couldn't email it (no SMTP configured). */
  readonly inviteLink = signal<string | null>(null);

  // ── Audit
  readonly audit = signal<AuditPage | null>(null);
  readonly auditLoading = signal(false);
  readonly auditAction = signal('');
  auditPage = 1;
  readonly auditActions = [
    { value: '', label: 'All actions' },
    { value: 'admin.', label: 'Admin management' },
    { value: 'auth.', label: 'Passwords & invites' },
    { value: 'app_session.', label: 'App sessions' },
  ];

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list().subscribe({
      next: (list) => {
        this.admins.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load admins.');
        this.loading.set(false);
      },
    });
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    if (t === 'audit' && !this.audit()) this.loadAudit();
  }

  // ── Table helpers
  appName(id: string): string {
    return APP_REGISTRY.find((a) => a.id === id)?.name ?? id;
  }

  appIcon(id: string): string {
    return APP_REGISTRY.find((a) => a.id === id)?.icon ?? '';
  }

  grantSummary(g: AccessGrant): string {
    const scope = g.modules.length ? `${g.modules.length} module${g.modules.length === 1 ? '' : 's'}` : 'all modules';
    return `${this.appName(g.appId)}: ${APP_ROLE_LABELS[g.role]}, ${scope}`;
  }

  // ── Dialog
  openInvite(): void {
    this.formError.set('');
    this.inviteLink.set(null);
    this.draft.set({ id: null, name: '', email: '', role: 'ADMIN', grants: this.emptyGrants() });
  }

  openEdit(a: AdminAccount): void {
    this.formError.set('');
    this.inviteLink.set(null);
    const grants = this.emptyGrants();
    for (const g of a.access) {
      const all = this.apps().find((x) => x.id === g.appId)?.modules.map((m) => m.id) ?? [];
      grants[g.appId] = { role: g.role, modules: g.modules.length ? [...g.modules] : all };
    }
    this.draft.set({ id: a.id, name: a.name, email: a.email, role: a.role, grants });
  }

  closeDialog(): void {
    this.draft.set(null);
    this.inviteLink.set(null);
  }

  patchDraft(patch: Partial<Draft>): void {
    const d = this.draft();
    if (d) this.draft.set({ ...d, ...patch });
  }

  setAppRole(appId: string, role: AppRole | ''): void {
    const d = this.draft();
    if (!d) return;
    const all = this.apps().find((x) => x.id === appId)?.modules.map((m) => m.id) ?? [];
    const current = d.grants[appId];
    // Turning an app on starts with every module ticked.
    const modules = role && !current.role ? all : current.modules;
    this.draft.set({ ...d, grants: { ...d.grants, [appId]: { role, modules } } });
  }

  toggleModule(appId: string, module: string): void {
    const d = this.draft();
    if (!d) return;
    const g = d.grants[appId];
    const modules = g.modules.includes(module) ? g.modules.filter((m) => m !== module) : [...g.modules, module];
    this.draft.set({ ...d, grants: { ...d.grants, [appId]: { ...g, modules } } });
  }

  toggleAllModules(appId: string): void {
    const d = this.draft();
    if (!d) return;
    const all = this.apps().find((x) => x.id === appId)?.modules.map((m) => m.id) ?? [];
    const g = d.grants[appId];
    const modules = g.modules.length === all.length ? [] : all;
    this.draft.set({ ...d, grants: { ...d.grants, [appId]: { ...g, modules } } });
  }

  hintFor(role: AppRole | ''): string {
    return role ? APP_ROLE_HINTS[role] : '';
  }

  isEditingSelf(): boolean {
    return this.draft()?.id === this.meId();
  }

  /** Grants to send: apps with a role and at least one module; all ticked → []. */
  private grantsToSend(d: Draft): AccessGrant[] | string {
    const out: AccessGrant[] = [];
    for (const app of this.apps()) {
      const g = d.grants[app.id];
      if (!g?.role) continue;
      if (!g.modules.length) return `Pick at least one ${app.name} module, or set it to No access.`;
      const all = g.modules.length === app.modules.length;
      out.push({ appId: app.id, role: g.role, modules: all ? [] : g.modules });
    }
    return out;
  }

  save(): void {
    const d = this.draft();
    if (!d || this.saving()) return;
    if (!d.name.trim()) return this.formError.set('Enter a name.');
    if (!d.id && !/^\S+@\S+\.\S+$/.test(d.email.trim())) return this.formError.set('Enter a valid email.');
    const access = d.role === 'SUPERADMIN' ? [] : this.grantsToSend(d);
    if (typeof access === 'string') return this.formError.set(access);
    if (d.role === 'ADMIN' && !access.length) {
      return this.formError.set('Give access to at least one app, or make them a superadmin.');
    }

    this.saving.set(true);
    this.formError.set('');
    if (!d.id) {
      this.api.invite({ name: d.name.trim(), email: d.email.trim(), role: d.role, access }).subscribe({
        next: (r) => {
          this.saving.set(false);
          this.load();
          if (r.inviteUrl) {
            this.inviteLink.set(r.inviteUrl);
            this.toast.info('Invite created. Email isn’t set up on the server, so share the link yourself.');
          } else {
            this.toast.success(`Invite sent to ${r.admin.email}.`);
            this.closeDialog();
          }
        },
        error: (e) => this.fail(e),
      });
      return;
    }

    const original = this.admins()?.find((a) => a.id === d.id);
    const profile: { name?: string; role?: AdminRole } = {};
    if (original && d.name.trim() !== original.name) profile.name = d.name.trim();
    if (original && d.role !== original.role) profile.role = d.role;
    const id = d.id;
    const afterProfile = () => {
      if (d.role === 'SUPERADMIN') return this.done('Admin updated.');
      this.api.setAccess(id, access).subscribe({ next: () => this.done('Access updated.'), error: (e) => this.fail(e) });
    };
    if (Object.keys(profile).length) {
      this.api.update(id, profile).subscribe({ next: afterProfile, error: (e) => this.fail(e) });
    } else {
      afterProfile();
    }
  }

  copyInviteLink(): void {
    const link = this.inviteLink();
    if (!link) return;
    navigator.clipboard?.writeText(link).then(
      () => this.toast.success('Invite link copied.'),
      () => this.toast.error('Could not copy. Select the link and copy it.'),
    );
  }

  // ── Row actions
  async setActive(a: AdminAccount, isActive: boolean): Promise<void> {
    const ok = await this.confirm.ask({
      title: isActive ? `Reactivate ${a.name}?` : `Deactivate ${a.name}?`,
      message: isActive
        ? 'They can sign in again with their existing password and access.'
        : 'They are signed out everywhere and can’t sign in. Their access and history are kept.',
      confirmLabel: isActive ? 'Reactivate' : 'Deactivate',
      tone: isActive ? 'primary' : 'danger',
    });
    if (!ok) return;
    this.run(a.id, this.api.update(a.id, { isActive }), isActive ? 'Admin reactivated.' : 'Admin deactivated.');
  }

  resendInvite(a: AdminAccount): void {
    this.busyId.set(a.id);
    this.api.resendInvite(a.id).subscribe({
      next: (r) => {
        this.busyId.set(null);
        if (r.inviteUrl) {
          this.openEdit(a);
          this.inviteLink.set(r.inviteUrl);
        } else {
          this.toast.success(`New invite sent to ${a.email}.`);
        }
      },
      error: (e) => {
        this.busyId.set(null);
        this.toast.error(messageOf(e, 'Could not resend the invite.'));
      },
    });
  }

  async sendReset(a: AdminAccount): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Send ${a.name} a reset link?`,
      message: `${a.email} gets a link to choose a new password (valid 30 minutes). Their current password keeps working until they use it.`,
      confirmLabel: 'Send link',
    });
    if (!ok) return;
    this.run(a.id, this.api.sendReset(a.id), `Reset link sent to ${a.email}.`);
  }

  // ── Audit
  loadAudit(): void {
    this.auditLoading.set(true);
    this.api.audit({ action: this.auditAction() || undefined, page: this.auditPage, limit: 20 }).subscribe({
      next: (p) => {
        this.audit.set(p);
        this.auditLoading.set(false);
      },
      error: () => {
        this.auditLoading.set(false);
        this.toast.error('Could not load the audit log.');
      },
    });
  }

  setAuditAction(v: string): void {
    this.auditAction.set(v);
    this.auditPage = 1;
    this.loadAudit();
  }

  auditGoTo(p: number): void {
    this.auditPage = p;
    this.loadAudit();
  }

  actionLabel(action: string): string {
    return AUDIT_ACTION_LABELS[action] ?? action;
  }

  /** "Priya (priya@…)" for admin targets; app name for app sessions. */
  targetLabel(e: { action: string; target: string | null; detail: Record<string, unknown> | null }): string {
    if (!e.target) return '—';
    if (e.action.startsWith('app_session.')) return this.appName(e.target);
    const admin = this.admins()?.find((a) => a.id === e.target);
    const email = (e.detail?.['email'] as string | undefined) ?? admin?.email;
    return admin ? `${admin.name} (${admin.email})` : (email ?? e.target);
  }

  // ── internals
  private emptyGrants(): Record<string, DraftGrant> {
    return Object.fromEntries(this.apps().map((a) => [a.id, { role: '' as const, modules: [] }]));
  }

  private run(id: string, req: Observable<unknown>, ok: string): void {
    this.busyId.set(id);
    req.subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(ok);
        this.load();
      },
      error: (e: unknown) => {
        this.busyId.set(null);
        this.toast.error(messageOf(e, 'That didn’t work. Please try again.'));
      },
    });
  }

  private done(message: string): void {
    this.saving.set(false);
    this.toast.success(message);
    this.closeDialog();
    this.load();
  }

  private fail(e: unknown): void {
    this.saving.set(false);
    this.formError.set(messageOf(e, 'Could not save. Please try again.'));
  }
}

function messageOf(e: unknown, fallback: string): string {
  const m = (e as { error?: { message?: string | string[] } })?.error?.message;
  return (Array.isArray(m) ? m[0] : m) || fallback;
}

/** appId → module id → sidebar label, read from the app routes' navItems. */
function moduleLabels(routes: Router['config']): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const r of routes) {
    const appId = r.data?.['appId'] as string | undefined;
    const items = r.data?.['navItems'] as AppNavItem[] | undefined;
    if (!appId || !items) continue;
    out[appId] = Object.fromEntries(items.map((i) => [navModule(i), i.label]));
  }
  return out;
}
