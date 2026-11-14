import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  Inbox,
  NotificationBell,
  NotificationList,
  NotificationProvider,
  UnreadBadge,
  createInbox,
  memoryAdapter,
} from '../../src';
import type { Notification } from '../../src';
import { minutesAgo } from './fixtures';

const n = (id: string, extra: Partial<Notification<ReactNode>> = {}): Notification<ReactNode> => ({
  id,
  type: 'comment',
  title: `Comment ${id}`,
  body: `Body ${id}`,
  createdAt: minutesAgo(Number(id)),
  ...extra,
});

async function setup(items = [n('1'), n('2'), n('3', { readAt: minutesAgo(1) })], ui?: ReactNode) {
  const inbox = createInbox({ adapter: memoryAdapter(items) });
  const utils = render(
    <NotificationProvider inbox={inbox}>{ui ?? <NotificationBell />}</NotificationProvider>,
  );
  await waitFor(() => expect(inbox.getSnapshot().status).toBe('ready'));
  return { inbox, ...utils };
}

describe('NotificationBell', () => {
  it('shows the unread count and an accessible label', async () => {
    await setup();
    const bell = screen.getByRole('button', { name: 'Notifications, 2 unread' });
    expect(bell).toHaveAttribute('aria-expanded', 'false');
    expect(within(bell).getByText('2')).toHaveClass('pingly-badge');
  });

  it('caps the badge at max', async () => {
    await setup(
      Array.from({ length: 12 }, (_, i) => n(String(i + 1))),
      <NotificationBell max={9} />,
    );
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('opens a dialog with the notifications and closes on Escape, returning focus', async () => {
    await setup();
    const bell = screen.getByRole('button', { name: /Notifications/ });
    fireEvent.click(bell);
    const dialog = screen.getByRole('dialog', { name: 'Notifications' });
    expect(within(dialog).getByText('Comment 1')).toBeInTheDocument();
    expect(within(dialog).getByText('Today')).toBeInTheDocument();
    expect(bell).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(bell);
  });

  it('closes on outside pointer down', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('marks everything read', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled();
  });

  it('switches to the unread tab', async () => {
    const { inbox } = await setup();
    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Unread' }));
    await waitFor(() => expect(inbox.getSnapshot().filter.status).toBe('unread'));
    expect(screen.getByRole('tab', { name: 'Unread' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('Comment 3')).not.toBeInTheDocument();
  });

  it('rings and announces new arrivals', async () => {
    const { inbox } = await setup();
    act(() => inbox.receive(n('0', { createdAt: new Date().toISOString() })));
    expect(screen.getByRole('button', { name: 'Notifications, 3 unread' })).toHaveAttribute(
      'data-ringing',
      'true',
    );
    expect(screen.getByText('1 new notification')).toBeInTheDocument();
  });
});

describe('NotificationItem', () => {
  it('marks read and navigates on click', async () => {
    const onNavigate = vi.fn();
    const { inbox } = await setup(
      [n('1', { url: '/posts/1' })],
      <NotificationList onNavigate={onNavigate} />,
    );
    fireEvent.click(screen.getByRole('link', { name: /Comment 1/ }));
    expect(inbox.get('1')?.readAt).toBeTruthy();
    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1' }),
      expect.anything(),
    );
  });

  it('toggles read state and archives from the item tools', async () => {
    const { inbox } = await setup([n('1')], <NotificationList />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    expect(inbox.getUnreadCount()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Mark as unread' }));
    expect(inbox.getUnreadCount()).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(screen.queryByText('Comment 1')).not.toBeInTheDocument();
  });

  it('renders actions and grouped counts', async () => {
    const onAction = vi.fn();
    await setup(
      [
        n('1', { groupKey: 'g', actions: [{ id: 'reply', label: 'Reply', variant: 'primary' }] }),
        n('2', { groupKey: 'g' }),
        n('3', { groupKey: 'g' }),
      ],
      <NotificationList onAction={onAction} />,
    );
    expect(screen.getByText('+2 more')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    expect(onAction).toHaveBeenCalledWith('reply', expect.objectContaining({ id: '1' }));
  });
});

describe('NotificationList states', () => {
  it('shows the empty state', async () => {
    await setup([], <NotificationList />);
    expect(screen.getByText("You're all caught up")).toBeInTheDocument();
  });

  it('shows an error with retry', async () => {
    const inbox = createInbox({ adapter: { list: () => Promise.reject(new Error('x')) } });
    render(
      <NotificationProvider inbox={inbox}>
        <NotificationList />
      </NotificationProvider>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load notifications");
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('moves between items with arrow keys', async () => {
    await setup(undefined, <NotificationList />);
    const items = screen.getAllByRole('button', { name: /Comment/ });
    items[0]!.focus();
    fireEvent.keyDown(items[0]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
  });
});

describe('Inbox page', () => {
  it('selects all and runs bulk actions', async () => {
    const { inbox } = await setup(undefined, <Inbox />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
    expect(screen.getByText('3 selected')).toBeInTheDocument();
    const bulk = within(document.querySelector<HTMLElement>('.pingly-bulk')!);
    fireEvent.click(bulk.getByRole('button', { name: 'Mark as read' }));
    expect(inbox.getUnreadCount()).toBe(0);
    fireEvent.click(screen.getAllByRole('checkbox')[1]!);
    fireEvent.click(bulk.getByRole('button', { name: 'Delete' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});

describe('UnreadBadge', () => {
  it('works with an explicit count and without a provider', () => {
    render(<UnreadBadge count={150} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });
});
