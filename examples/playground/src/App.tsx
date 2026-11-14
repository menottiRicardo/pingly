import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  BannerHost,
  ConnectionStatus,
  NotificationBell,
  NotificationProvider,
  Toaster,
  defineRoutes,
  toast,
  type Theme,
} from 'pingly';
import { createDemoClient } from './backend/client';
import { describeEvent, formatMoney } from './backend/describe';
import { publishRandom } from './backend/random';
import { ChaosPanel } from './components/ChaosPanel';
import { CrashTrigger, ErrorBoundary } from './ErrorBoundary';
import { BannersPage } from './pages/BannersPage';
import { BrowserPage } from './pages/BrowserPage';
import { InboxPage } from './pages/InboxPage';
import { PreferencesPage } from './pages/PreferencesPage';
import { RealtimePage } from './pages/RealtimePage';
import { ToastsPage } from './pages/ToastsPage';
import { ROUTES, navigate, useRoute, type RouteId } from './router';
import { useSettings } from './settings';
import { inbox, preferences } from './stores';

const PAGES: Record<RouteId, ComponentType> = {
  toasts: ToastsPage,
  inbox: InboxPage,
  realtime: RealtimePage,
  banners: BannersPage,
  preferences: PreferencesPage,
  browser: BrowserPage,
};

export function App() {
  const { settings, update } = useSettings();
  const { route } = useRoute();
  const [crash, setCrash] = useState(false);

  // One client per transport. It connects on mount and disconnects on unmount
  // or when the transport changes.
  const client = useMemo(() => createDemoClient(settings.transport), [settings.transport]);
  useEffect(() => {
    client.connect();
    return () => client.disconnect();
  }, [client]);

  // Realtime events → inbox entries and toasts, typed from AppEvents.
  const routes = useMemo(
    () =>
      defineRoutes(client, {
        'comment.created': {
          notification: (p) => describeEvent('comment.created', p),
          toast: (p) => ({ title: `${p.author} commented`, description: p.text }),
        },
        'invoice.paid': {
          notification: (p) => describeEvent('invoice.paid', p),
          toast: (p) => ({
            title: `Payment received: ${formatMoney(p.amount, p.currency)}`,
            type: 'success',
          }),
        },
        'deploy.finished': {
          notification: (p) => describeEvent('deploy.finished', p),
          toast: (p) =>
            p.status === 'failed'
              ? {
                  title: `${p.project} deploy failed`,
                  type: 'error',
                  dedupeKey: `deploy-${p.project}`,
                  action: { label: 'View', onClick: () => navigate('inbox') },
                }
              : null,
        },
        mention: { notification: (p) => describeEvent('mention', p) },
        'security.alert': {
          notification: (p) => describeEvent('security.alert', p),
          toast: (p) => ({
            title: 'New sign-in',
            description: `${p.device} · ${p.location}`,
            type: 'warning',
          }),
        },
      }),
    [client],
  );

  // Surface failed (and rolled back) inbox actions.
  useEffect(
    () =>
      inbox.events.on('error', ({ action, error }) =>
        toast.error(
          action === 'load' ? "Couldn't load notifications" : `Couldn't ${action} — change undone`,
          {
            description: error instanceof Error ? error.message : undefined,
            dedupeKey: `inbox-error-${action}`,
          },
        ),
      ),
    [],
  );

  // Simulated server activity.
  useEffect(() => {
    if (!settings.streaming) return;
    const id = setInterval(publishRandom, settings.streamEveryMs);
    return () => clearInterval(id);
  }, [settings.streaming, settings.streamEveryMs]);

  const Page = PAGES[route];

  return (
    <NotificationProvider
      inbox={inbox}
      client={client}
      routes={routes}
      preferences={preferences}
      theme={settings.theme}
      locale={settings.locale}
      systemNotifications={settings.systemNotifications}
      sound={settings.sound}
      documentBadge={{ title: settings.titleBadge, favicon: settings.faviconBadge }}
    >
      <div className="app pingly-root" data-theme={settings.theme}>
        <BannerHost />
        <header className="app-header">
          <a className="app-logo" href="#/toasts">
            pingly <span>playground</span>
          </a>
          <span className="app-tools">
            <ConnectionStatus client={client} />
            <select
              aria-label="Theme"
              value={settings.theme}
              onChange={(e) => update('theme', e.target.value as Theme)}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
            <select
              aria-label="Language"
              value={settings.locale}
              onChange={(e) => update('locale', e.target.value)}
            >
              <option value="en-US">English</option>
              <option value="pt-BR">Português</option>
              <option value="es-ES">Español</option>
              <option value="de-DE">Deutsch</option>
            </select>
            <NotificationBell
              onSettings={() => navigate('preferences')}
              onAction={(action, n) => toast.info(`“${action}” on ${String(n.title)}`)}
              onNavigate={(n) => {
                if (n.url) window.location.hash = n.url.replace(/^#/, '');
              }}
              tabs={[
                { id: 'all', label: 'All', filter: { status: 'all' } },
                { id: 'unread', label: 'Unread', filter: { status: 'unread' } },
                { id: 'comments', label: 'Comments', filter: { category: 'comments' } },
                { id: 'billing', label: 'Billing', filter: { category: 'billing' } },
              ]}
              footer={
                <a className="pingly-text-button" href="#/inbox">
                  View all notifications
                </a>
              }
            />
          </span>
        </header>

        <div className="app-body">
          <nav className="app-nav" aria-label="Sections">
            {ROUTES.map((r) => (
              <a key={r.id} href={`#/${r.id}`} aria-current={route === r.id ? 'page' : undefined}>
                {r.label}
              </a>
            ))}
          </nav>
          <main className="app-main">
            <ErrorBoundary resetKey={route} onReset={() => setCrash(false)}>
              <CrashTrigger crash={crash} />
              <Page />
            </ErrorBoundary>
          </main>
        </div>

        <ChaosPanel onCrash={() => setCrash(true)} />
        <Toaster
          position={settings.position}
          stacked={settings.stacked}
          richColors={settings.richColors}
          progress={settings.progress}
          closeButton={settings.closeButton}
        />
        <Toaster id="side" position="top-left" label="Secondary notifications" />
      </div>
    </NotificationProvider>
  );
}
