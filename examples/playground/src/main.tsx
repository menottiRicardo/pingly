import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Alert,
  Banner,
  BannerHost,
  ConnectionStatus,
  Inbox,
  NotificationBell,
  NotificationPreferences,
  NotificationProvider,
  PermissionPrompt,
  Toaster,
  banner,
  defineRoutes,
  toast,
  type Theme,
  type ToastPosition,
} from 'pingly';
import 'pingly/styles.css';
import './playground.css';
import { inbox, preferences } from './data';
import { client, pushRandomEvent, server } from './server';

const routes = defineRoutes(client, {
  'comment.created': {
    notification: (p) => ({
      title: `${p.author} commented on ${p.postTitle}`,
      body: p.text,
      avatar: p.avatar,
      category: 'comments',
      groupKey: `post-${p.postId}`,
      actions: [{ id: 'reply', label: 'Reply', variant: 'primary' }],
    }),
    toast: (p) => ({ title: `${p.author} commented`, description: p.text }),
  },
  'invoice.paid': {
    notification: (p) => ({
      title: `Invoice ${p.invoiceId} was paid`,
      body: `${p.currency} ${p.amount.toFixed(2)}`,
      category: 'billing',
    }),
    toast: (p) => ({ title: `Payment received: $${p.amount}`, type: 'success' }),
  },
  'deploy.finished': {
    notification: (p) => ({
      title: p.status === 'success' ? `${p.project} deployed` : `${p.project} deploy failed`,
      category: 'deploys',
    }),
    toast: (p) =>
      p.status === 'failed'
        ? { title: `${p.project} deploy failed`, type: 'error', dedupeKey: 'deploy-failed' }
        : null,
  },
  mention: {
    notification: (p) => ({
      title: `${p.author} mentioned you in ${p.channel}`,
      avatar: p.avatar,
      category: 'mentions',
    }),
  },
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const positions: ToastPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];
type Tab = 'toasts' | 'inbox' | 'banners' | 'preferences' | 'browser';

function App() {
  const [tab, setTab] = useState<Tab>('toasts');
  const [theme, setTheme] = useState<Theme>('light');
  const [position, setPosition] = useState<ToastPosition>('bottom-right');
  const [stacked, setStacked] = useState(false);
  const [richColors, setRichColors] = useState(false);
  const [progress, setProgress] = useState(true);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(pushRandomEvent, 3500);
    return () => clearInterval(id);
  }, [live]);

  return (
    <NotificationProvider
      inbox={inbox}
      client={client}
      routes={routes}
      preferences={preferences}
      theme={theme}
      documentBadge
      systemNotifications
    >
      <div className="app" data-theme={theme}>
        <BannerHost />
        <header className="app-header">
          <strong className="app-logo">pingly</strong>
          <nav className="app-nav">
            {(['toasts', 'inbox', 'banners', 'preferences', 'browser'] as Tab[]).map((t) => (
              <button
                key={t}
                aria-current={tab === t ? 'page' : undefined}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </nav>
          <span className="app-tools">
            <ConnectionStatus client={client} />
            <select
              aria-label="Theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value as Theme)}
            >
              <option>light</option>
              <option>dark</option>
              <option>system</option>
            </select>
            <NotificationBell
              onSettings={() => setTab('preferences')}
              onAction={(action, n) => toast.info(`“${action}” on: ${String(n.title)}`)}
              tabs={[
                { id: 'all', label: 'All', filter: { status: 'all' } },
                { id: 'unread', label: 'Unread', filter: { status: 'unread' } },
                { id: 'comments', label: 'Comments', filter: { category: 'comments' } },
                { id: 'billing', label: 'Billing', filter: { category: 'billing' } },
              ]}
            />
          </span>
        </header>

        <main className="app-main">
          <section className="card">
            <h2>Live events</h2>
            <p>A pretend server pushes typed events through the realtime client.</p>
            <div className="row">
              <button onClick={pushRandomEvent}>Push one event</button>
              <button onClick={() => setLive((v) => !v)}>
                {live ? 'Stop stream' : 'Start stream'}
              </button>
              <button onClick={() => server.simulateDisconnect()}>Drop connection</button>
              <button
                onClick={() =>
                  client.getStatus() === 'closed' ? client.connect() : client.disconnect()
                }
              >
                Toggle connection
              </button>
            </div>
          </section>

          {tab === 'toasts' && (
            <section className="card">
              <h2>Toasts</h2>
              <div className="row">
                <button onClick={() => toast('Event created')}>Default</button>
                <button
                  onClick={() =>
                    toast.success('Profile saved', { description: 'Changes are live.' })
                  }
                >
                  Success
                </button>
                <button
                  onClick={() =>
                    toast.error('Upload failed', { description: 'File is too large.' })
                  }
                >
                  Error
                </button>
                <button onClick={() => toast.info('New version available')}>Info</button>
                <button onClick={() => toast.warning('Storage almost full')}>Warning</button>
                <button
                  onClick={() =>
                    toast.promise(
                      wait(1500).then(() => 'report.pdf'),
                      {
                        loading: 'Generating report…',
                        success: (name) => `${name} is ready`,
                        error: 'Could not generate report',
                      },
                    )
                  }
                >
                  Promise
                </button>
                <button
                  onClick={() =>
                    toast('Message archived', {
                      action: { label: 'Undo', onClick: () => toast.success('Restored') },
                    })
                  }
                >
                  With action
                </button>
                <button onClick={() => toast('Link copied', { dedupeKey: 'copy' })}>
                  Dedupe (click a few times)
                </button>
                <button
                  onClick={() =>
                    toast.custom((id) => (
                      <div className="custom-toast">
                        🎉 You unlocked a badge!
                        <button onClick={() => toast.dismiss(id)}>Nice</button>
                      </div>
                    ))
                  }
                >
                  Custom
                </button>
                <button onClick={() => toast.dismiss()}>Dismiss all</button>
              </div>
              <div className="row">
                <label>
                  Position{' '}
                  <select
                    value={position}
                    onChange={(e) => setPosition(e.target.value as ToastPosition)}
                  >
                    {positions.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={stacked}
                    onChange={(e) => setStacked(e.target.checked)}
                  />{' '}
                  Stacked
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={richColors}
                    onChange={(e) => setRichColors(e.target.checked)}
                  />{' '}
                  Rich colors
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={progress}
                    onChange={(e) => setProgress(e.target.checked)}
                  />{' '}
                  Progress
                </label>
              </div>
              <p className="hint">
                Tip: swipe toasts away, hover to pause, press Alt+T to focus them.
              </p>
            </section>
          )}

          {tab === 'inbox' && (
            <Inbox
              onAction={(action, n) => toast.info(`“${action}” on: ${String(n.title)}`)}
              onSettings={() => setTab('preferences')}
            />
          )}

          {tab === 'banners' && (
            <section className="card">
              <h2>Banners & alerts</h2>
              <div className="row">
                <button onClick={() => banner.info('Scheduled maintenance Sunday 02:00 UTC')}>
                  Info banner
                </button>
                <button
                  onClick={() =>
                    banner.error('Your card was declined', {
                      priority: 10,
                      description: 'Update your payment method to avoid interruption.',
                      action: { label: 'Update card', onClick: () => toast('Opening billing…') },
                    })
                  }
                >
                  Urgent banner
                </button>
                <button
                  onClick={() =>
                    banner.success('We use cookies to keep you signed in.', {
                      dismissKey: 'cookies',
                    })
                  }
                >
                  Remembered dismissal
                </button>
                <button onClick={() => banner.forget('cookies')}>Forget dismissal</button>
              </div>
              <Banner
                variant="neutral"
                action={{ label: 'Try it', onClick: () => setTheme('dark') }}
              >
                New: dark mode is here
              </Banner>
              <div className="stack">
                <Alert variant="info" title="Heads up">
                  Your trial ends in 3 days.
                </Alert>
                <Alert variant="success" title="Backup complete" />
                <Alert
                  variant="warning"
                  title="Unusual sign-in"
                  actions={<button className="pingly-button">Review</button>}
                >
                  We noticed a sign-in from a new device.
                </Alert>
                <Alert variant="error" title="Sync failed" onDismiss={() => {}}>
                  We'll retry automatically.
                </Alert>
              </div>
            </section>
          )}

          {tab === 'preferences' && <NotificationPreferences store={preferences} />}

          {tab === 'browser' && (
            <section className="card">
              <h2>Browser</h2>
              <p>
                Desktop notifications appear for new events while this tab is in the background.
              </p>
              <PermissionPrompt storageKey={false} />
              <p className="hint">The unread count is mirrored in the tab title.</p>
            </section>
          )}
        </main>

        <Toaster
          position={position}
          stacked={stacked}
          richColors={richColors}
          progress={progress}
          closeButton
        />
      </div>
    </NotificationProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
