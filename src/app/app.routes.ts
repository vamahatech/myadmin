import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { verdiqSessionGuard } from './core/guards/verdiq-session.guard';
import { renewloopSessionGuard } from './core/guards/renewloop-session.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/settings/settings.component').then(m => m.SettingsComponent),
  },
  {
    path: 'apps/vamaha',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/components/app-shell/app-shell.component').then(
        m => m.AppShellComponent,
      ),
    data: {
      appId: 'vamaha',
      appName: 'Vamaha',
      navItems: [
        { label: 'Articles', icon: 'file-text', path: '', activePrefixes: ['articles'] },
        { label: 'Push notifications', icon: 'bell', path: 'push' },
      ],
    },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/apps/vamaha/admin-dashboard/admin-dashboard.component').then(
            m => m.AdminDashboardComponent,
          ),
      },
      {
        path: 'push',
        loadComponent: () =>
          import('./pages/apps/vamaha/admin-push/admin-push.component').then(
            m => m.AdminPushComponent,
          ),
      },
      {
        // Must precede 'articles/:id' — static segments don't win over
        // parameterized ones by registration order alone.
        path: 'articles/new',
        loadComponent: () =>
          import('./pages/apps/vamaha/new-article/new-article.component').then(
            m => m.NewArticleComponent,
          ),
      },
      {
        path: 'articles/:id',
        loadComponent: () =>
          import('./pages/apps/vamaha/admin-article/admin-article.component').then(
            m => m.AdminArticleComponent,
          ),
      },
    ],
  },
  {
    path: 'apps/emi-planner',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/components/app-shell/app-shell.component').then(
        m => m.AppShellComponent,
      ),
    data: {
      appId: 'emi-planner',
      appName: 'EMI Planner',
      navItems: [
        { label: 'Analytics', icon: 'bar-chart', path: 'analytics' },
        { label: 'Push & retention', icon: 'bell', path: 'push' },
        { label: 'Feedback', icon: 'message', path: 'feedback' },
      ],
    },
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'analytics',
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./pages/apps/emi-planner/analytics/analytics.component').then(
            m => m.AnalyticsComponent,
          ),
      },
      {
        path: 'push',
        loadComponent: () =>
          import('./pages/apps/emi-planner/push/push.component').then(
            m => m.PushComponent,
          ),
      },
      {
        path: 'feedback',
        loadComponent: () =>
          import('./pages/apps/emi-planner/feedback/feedback.component').then(
            m => m.FeedbackComponent,
          ),
      },
    ],
  },
  {
    path: 'apps/verdiq',
    canActivate: [authGuard, verdiqSessionGuard],
    loadComponent: () =>
      import('./shared/components/app-shell/app-shell.component').then(
        m => m.AppShellComponent,
      ),
    data: {
      appId: 'verdiq',
      appName: 'Verdiq',
      contentClass: 'verdiq-app',
      navItems: [
        { label: 'Overview', icon: 'layout', path: 'overview' },
        { label: 'Products', icon: 'package', path: 'products' },
        { label: 'Coverage & gaps', icon: 'target', path: 'coverage' },
        { label: 'Verdict review', icon: 'scale', path: 'verdicts' },
        { label: 'Additives (INS)', icon: 'flask', path: 'additives' },
        { label: 'Double standards', icon: 'globe', path: 'double-standards' },
        { label: 'Alternatives', icon: 'repeat', path: 'alternatives' },
        { label: 'Analytics', icon: 'trending-up', path: 'analytics' },
        { label: 'Submissions', icon: 'inbox', path: 'submissions' },
        { label: 'Reports', icon: 'flag', path: 'reports' },
        { label: 'Feedback', icon: 'message', path: 'feedback' },
        { label: 'Ingest review', icon: 'cart', path: 'ingest' },
        { label: 'Users & testers', icon: 'users', path: 'users' },
      ],
    },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        loadComponent: () =>
          import('./pages/apps/verdiq/overview/overview').then(m => m.Overview),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./pages/apps/verdiq/products/products-list').then(m => m.ProductsList),
      },
      {
        // Must precede 'products/:id' — static segments don't win over
        // parameterized ones by registration order alone.
        path: 'products/new',
        loadComponent: () =>
          import('./pages/apps/verdiq/products/product-detail').then(m => m.ProductDetail),
      },
      {
        path: 'products/:id',
        loadComponent: () =>
          import('./pages/apps/verdiq/products/product-detail').then(m => m.ProductDetail),
      },
      {
        path: 'coverage',
        loadComponent: () =>
          import('./pages/apps/verdiq/coverage/coverage').then(m => m.Coverage),
      },
      {
        path: 'verdicts',
        loadComponent: () =>
          import('./pages/apps/verdiq/verdicts/verdict-review').then(m => m.VerdictReview),
      },
      {
        path: 'additives',
        loadComponent: () =>
          import('./pages/apps/verdiq/additives/additives').then(m => m.Additives),
      },
      {
        path: 'double-standards',
        loadComponent: () =>
          import('./pages/apps/verdiq/double-standards/double-standards').then(m => m.DoubleStandards),
      },
      {
        path: 'alternatives',
        loadComponent: () =>
          import('./pages/apps/verdiq/alternatives/alternatives').then(m => m.Alternatives),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./pages/apps/verdiq/analytics/analytics').then(m => m.Analytics),
      },
      {
        path: 'submissions',
        loadComponent: () =>
          import('./pages/apps/verdiq/submissions/submissions').then(m => m.Submissions),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./pages/apps/verdiq/reports/reports').then(m => m.Reports),
      },
      {
        path: 'feedback',
        loadComponent: () =>
          import('./pages/apps/verdiq/feedback/feedback').then(m => m.Feedback),
      },
      {
        path: 'ingest',
        loadComponent: () =>
          import('./pages/apps/verdiq/ingest/ingest').then(m => m.Ingest),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/apps/verdiq/users/users').then(m => m.Users),
      },
    ],
  },
  {
    path: 'apps/renewloop',
    canActivate: [authGuard, renewloopSessionGuard],
    loadComponent: () =>
      import('./shared/components/app-shell/app-shell.component').then(
        m => m.AppShellComponent,
      ),
    data: {
      appId: 'renewloop',
      appName: 'RenewLoop',
      navItems: [
        { label: 'Users', icon: 'users', path: 'users' },
        { label: 'Notifications', icon: 'bell', path: 'notifications' },
      ],
    },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'users' },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/apps/renewloop/users/users').then(m => m.RenewloopUsers),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./pages/apps/renewloop/notifications/notifications').then(
            m => m.RenewloopNotifications,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
