import { act, render, screen, waitFor } from '@testing-library/react';
import {
  NotificationBell,
  NotificationProvider,
  createInbox,
  createNotificationClient,
  toast,
} from '../../src';
import {
  createMockInboxAdapter,
  createMockTransport,
  fakeNotification,
  fakeNotifications,
  resetPingly,
} from '../../src/testing';
import { store as toastStore } from '../../src/toast/instance';

type Events = { 'order.shipped': { orderId: string } };
type Outgoing = { ack: { id: string } };

describe('createMockTransport', () => {
  it('drives a client end to end', async () => {
    const mock = createMockTransport<Events>();
    const client = createNotificationClient<Events, Outgoing>({
      transport: mock.transport,
      reconnect: { initial: 1, jitter: 'none' },
    });
    await vi.waitFor(() => expect(client.getStatus()).toBe('open'));
    const shipped = vi.fn();
    client.on('order.shipped', shipped);
    mock.emit('order.shipped', { orderId: 'o1' }, { id: 'e1' });
    expect(shipped).toHaveBeenCalledWith({ orderId: 'o1' }, expect.objectContaining({ id: 'e1' }));
    client.send('ack', { id: 'e1' });
    expect(mock.sent).toEqual([{ type: 'ack', payload: { id: 'e1' } }]);
    mock.simulateDisconnect();
    expect(client.getStatus()).toBe('reconnecting');
    await vi.waitFor(() => expect(mock.connections).toBe(2));
    expect(mock.lastEventId).toBe('e1');
    client.destroy();
  });
});

describe('fixtures', () => {
  it('builds notifications and records adapter calls', async () => {
    expect(fakeNotification({ title: 'Hi' })).toMatchObject({ title: 'Hi', readAt: null });
    const items = fakeNotifications(3, (i) => ({ category: i === 0 ? 'a' : 'b' }));
    expect(items.map((n) => n.category)).toEqual(['a', 'b', 'b']);
    const adapter = createMockInboxAdapter(items, { fail: { archive: true } });
    const inbox = createInbox({ adapter });
    await inbox.load();
    await inbox.archive(items[0]!.id);
    expect(adapter.calls.map((c) => c.method)).toEqual(['list', 'archive']);
    expect(inbox.get(items[0]!.id)?.archivedAt).toBeFalsy();
  });

  it('renders a bell from fixtures', async () => {
    const inbox = createInbox({ adapter: createMockInboxAdapter(fakeNotifications(4)) });
    render(
      <NotificationProvider inbox={inbox}>
        <NotificationBell />
      </NotificationProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Notifications, 4 unread' })).toBeInTheDocument(),
    );
  });
});

describe('resetPingly', () => {
  it('clears global stores', () => {
    act(() => {
      toast('left over');
    });
    resetPingly();
    expect(toastStore.getSnapshot()).toHaveLength(0);
  });
});
