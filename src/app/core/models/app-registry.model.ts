import type { IconName } from '../../shared/components/icon/icon.component';

export interface AppTile {
  id: string;
  name: string;
  icon: string;
  accentColor: string;
  route: string;
  /** One line, shown under the app name on the tile-home ledger. */
  tagline: string;
  /** How this app authenticates: 'shell' reuses the shell's AuthService token
   *  directly; 'service-credential' silently logs in to that app's own
   *  backend via AppSessionService (see Verdiq below). */
  authMode: 'shell' | 'service-credential';
}

export const APP_REGISTRY: AppTile[] = [
  {
    id: 'vamaha',
    name: 'Vamaha',
    icon: 'vamaha.svg',
    accentColor: 'var(--color-primary)',
    route: '/apps/vamaha',
    tagline: 'Articles and push notifications for the site and app.',
    authMode: 'shell',
  },
  {
    id: 'emi-planner',
    name: 'EMI Planner',
    icon: 'emiplanner.png',
    accentColor: 'var(--color-gold)',
    route: '/apps/emi-planner/analytics',
    tagline: 'Usage analytics for the loan calculator.',
    authMode: 'shell',
  },
  {
    id: 'verdiq',
    name: 'Verdiq',
    icon: 'verdiq.png',
    accentColor: 'var(--color-blue)',
    route: '/apps/verdiq',
    tagline: 'Child food safety verdicts, products, and moderation.',
    authMode: 'service-credential',
  },
  {
    id: 'renewloop',
    name: 'RenewLoop',
    icon: 'renewloop.png',
    accentColor: 'var(--color-primary)',
    route: '/apps/renewloop/users',
    tagline: 'Subscription renewals: user accounts and push notifications.',
    authMode: 'service-credential',
  },
];

/** One entry in an app's sidebar. Each app supplies its own list via route
 *  data; the shared AppSidebar only renders it. */
export interface AppNavItem {
  label: string;
  icon: IconName;
  /** Relative to the app's base route; '' is the app's landing page. */
  path: string;
  /** Extra child paths that should also mark this item active
   *  (e.g. an article editor under the Articles list). */
  activePrefixes?: string[];
}

export function findApp(id: string | undefined): AppTile | undefined {
  return APP_REGISTRY.find(a => a.id === id);
}
