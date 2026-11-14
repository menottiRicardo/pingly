import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  ConnectionStatus,
  NotificationBell,
  NotificationProvider,
  Toaster,
  createInbox,
  createNotificationClient,
  defineRoutes,
  memoryAdapter,
  useNotificationEvent,
} from '../../src';
import { manualTransport } from './helpers';

type Events = {
  'invoice.paid': { invoiceId: string; amount: number };
  'system.notice': { title: string; body: string };
};
type Outgoing = { 'presence.update': { online: boolean } };

async function setup(extra?: ReactNode) {
  const t = manualTransport();
  // Declaring outgoing types must not stop the client fitting the provider and routes.
  const client = createNotificationClient<Events, Outgoing>({ transport: t.transport });
  const inbox = createInbox({ adapter: memoryAdapter([]) });
  const routes = defineRoutes(client, {
    'invoice.paid': {
      notification: (p) => ({ title: `Invoice ${p.invoiceId} paid`, category: 'billing' }),
      toast: (p) => ({ title: `Received $${p.amount}`, type: 'success' }),
    },
  });
  render(
    <NotificationProvider inbox={inbox} client={client} routes={routes}>
      <NotificationBell />
      <ConnectionStatus client={client} />
      <Toaster />
      {extra}
    </NotificationProvider>,
  );
  await waitFor(() => expect(t.connections).toHaveLength(1));
  act(() => t.current.handlers.onOpen());
  return { t, client, inbox };
}

describe('NotificationProvider with a realtime client', () => {
  it('routes events into the inbox and toasts', async () => {
    const { t, inbox } = await setup();
    act(() =>
      t.current.handlers.onMessage({
        type: 'invoice.paid',
        payload: { invoiceId: 'INV-7', amount: 120 },
        id: 'e1',
      }),
    );
    expect(inbox.get('e1')).toMatchObject({
      title: 'Invoice INV-7 paid',
      category: 'billing',
      type: 'invoice.paid',
    });
    expect(screen.getByRole('button', { name: 'Notifications, 1 unread' })).toBeInTheDocument();
    expect(screen.getByText('Received $120')).toBeInTheDocument();
  });

  it('stores notification-shaped payloads without a route', async () => {
    const { t, inbox } = await setup();
    act(() =>
      t.current.handlers.onMessage({
        type: 'system.notice',
        payload: { title: 'Maintenance', body: 'Tonight' },
      }),
    );
    expect(Object.values(inbox.getSnapshot().items)[0]).toMatchObject({
      title: 'Maintenance',
      body: 'Tonight',
    });
  });

  it('shows the live connection status', async () => {
    const { t } = await setup();
    expect(screen.getByText('Live')).toBeInTheDocument();
    act(() => t.current.handlers.onClose());
    expect(screen.getByText('Reconnecting…')).toBeInTheDocument();
  });

  it('lets components subscribe to typed events', async () => {
    const seen: number[] = [];
    function Listener() {
      useNotificationEvent<Events, 'invoice.paid'>('invoice.paid', (p) => seen.push(p.amount));
      return null;
    }
    const { t } = await setup(<Listener />);
    act(() =>
      t.current.handlers.onMessage({
        type: 'invoice.paid',
        payload: { invoiceId: 'a', amount: 5 },
      }),
    );
    expect(seen).toEqual([5]);
  });

  it('offers a retry button once closed', async () => {
    const t = manualTransport();
    const client = createNotificationClient<Events>({ transport: t.transport, reconnect: false });
    render(<ConnectionStatus client={client} />);
    await waitFor(() => expect(t.connections).toHaveLength(1));
    act(() => t.current.handlers.onClose());
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(t.connections).toHaveLength(2));
    client.destroy();
  });
});
