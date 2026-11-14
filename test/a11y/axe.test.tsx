import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import {
  Alert,
  Banner,
  ConnectionStatus,
  Inbox,
  NotificationBell,
  NotificationPreferences,
  NotificationProvider,
  PermissionPrompt,
  Toaster,
  createInbox,
  createPreferences,
  toast,
} from '../../src';
import { createMockInboxAdapter, createMockTransport, fakeNotifications } from '../../src/testing';
import { createNotificationClient } from '../../src';

async function violations(root: Element = document.body) {
  // jsdom has no layout, so color-contrast can't be computed here.
  const result = await axe.run(root, { rules: { 'color-contrast': { enabled: false } } });
  return result.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
}

const items = () =>
  fakeNotifications(4, (i) => ({
    title: `Notification ${i}`,
    url: i % 2 ? `/n/${i}` : undefined,
    actions: i === 0 ? [{ id: 'reply', label: 'Reply' }] : undefined,
  }));

describe('accessibility (axe)', () => {
  it('toasts', async () => {
    render(<Toaster closeButton progress />);
    act(() => {
      toast.success('Saved', {
        description: 'All good',
        action: { label: 'Undo', onClick: () => {} },
      });
      toast.error('Failed');
    });
    expect(await violations()).toEqual([]);
  });

  it('bell with open popover', async () => {
    const inbox = createInbox({ adapter: createMockInboxAdapter(items()) });
    render(
      <main>
        <NotificationProvider inbox={inbox}>
          <NotificationBell onSettings={() => {}} />
        </NotificationProvider>
      </main>,
    );
    await waitFor(() => expect(inbox.getSnapshot().status).toBe('ready'));
    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
    expect(await violations()).toEqual([]);
  });

  it('inbox page', async () => {
    const inbox = createInbox({ adapter: createMockInboxAdapter(items()) });
    render(
      <main>
        <NotificationProvider inbox={inbox}>
          <Inbox />
        </NotificationProvider>
      </main>,
    );
    await waitFor(() => expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0));
    expect(await violations()).toEqual([]);
  });

  it('banners, alerts, status and permission prompt', async () => {
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: async () => 'granted',
    });
    const server = createMockTransport();
    const client = createNotificationClient({ transport: server.transport });
    render(
      <main>
        <Banner variant="warning" action={{ label: 'Fix', onClick: () => {} }} onDismiss={() => {}}>
          Heads up
        </Banner>
        <Alert variant="error" title="Sync failed" onDismiss={() => {}}>
          Retrying
        </Alert>
        <ConnectionStatus client={client} />
        <PermissionPrompt storageKey={false} />
      </main>,
    );
    expect(await violations()).toEqual([]);
    client.destroy();
    vi.unstubAllGlobals();
  });

  it('preferences', async () => {
    const store = createPreferences({
      categories: [
        { id: 'a', label: 'Comments', description: 'Replies' },
        { id: 'b', label: 'Security', locked: ['email'] },
      ],
      channels: [
        { id: 'inApp', label: 'In-app' },
        { id: 'email', label: 'Email' },
      ],
      autoSave: false,
    });
    render(
      <main>
        <NotificationPreferences store={store} />
      </main>,
    );
    expect(await violations()).toEqual([]);
  });
});
