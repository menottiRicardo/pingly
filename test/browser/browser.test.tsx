import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  NotificationProvider,
  PermissionPrompt,
  Toaster,
  createInbox,
  createNotificationClient,
  createPreferences,
  createSound,
  createTitleBadge,
  memoryAdapter,
  notify,
} from '../../src';
import { manualTransport } from '../realtime/helpers';

class FakeNotification {
  static permission: NotificationPermission = 'granted';
  static created: FakeNotification[] = [];
  static requestPermission = vi.fn(async () => {
    FakeNotification.permission = 'granted';
    return 'granted' as NotificationPermission;
  });
  onclick: (() => void) | null = null;
  closed = false;
  constructor(
    public title: string,
    public options: NotificationOptions,
  ) {
    FakeNotification.created.push(this);
  }
  close() {
    this.closed = true;
  }
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

beforeEach(() => {
  FakeNotification.created = [];
  FakeNotification.permission = 'granted';
  vi.stubGlobal('Notification', FakeNotification);
  setVisibility('hidden');
});
afterEach(() => {
  vi.unstubAllGlobals();
  setVisibility('visible');
});

describe('notify', () => {
  it('shows a notification while hidden and focuses the tab on click', async () => {
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => {});
    const n = (await notify({
      title: 'Hi',
      body: 'There',
      tag: 't',
    })) as unknown as FakeNotification;
    expect(n.title).toBe('Hi');
    expect(n.options).toMatchObject({ body: 'There', tag: 't' });
    n.onclick?.();
    expect(focus).toHaveBeenCalled();
    expect(n.closed).toBe(true);
  });

  it('skips when visible or not allowed', async () => {
    setVisibility('visible');
    expect(await notify({ title: 'x' })).toBeNull();
    setVisibility('hidden');
    FakeNotification.permission = 'denied';
    expect(await notify({ title: 'x' })).toBeNull();
  });
});

describe('createTitleBadge', () => {
  it('prefixes and restores the title, following app changes', () => {
    document.title = 'Inbox';
    const badge = createTitleBadge();
    badge.set(3);
    expect(document.title).toBe('(3) Inbox');
    badge.set(120);
    expect(document.title).toBe('(99+) Inbox');
    document.title = 'Settings';
    badge.set(2);
    expect(document.title).toBe('(2) Settings');
    badge.reset();
    expect(document.title).toBe('Settings');
  });
});

describe('createSound', () => {
  it('resolves false when audio is unavailable or muted', async () => {
    const sound = createSound();
    expect(await sound.play()).toBe(false);
    sound.setMuted(true);
    expect(sound.muted).toBe(true);
    expect(await sound.play()).toBe(false);
  });
});

describe('<PermissionPrompt />', () => {
  beforeEach(() => localStorage.clear());

  it('asks, then hides once granted', async () => {
    FakeNotification.permission = 'default';
    const onResult = vi.fn();
    render(<PermissionPrompt onResult={onResult} />);
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith('granted'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('remembers "Not now"', () => {
    FakeNotification.permission = 'default';
    const { unmount } = render(<PermissionPrompt />);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();
    render(<PermissionPrompt />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('NotificationProvider deliveries', () => {
  type Events = { 'comment.created': { text: string; category: string } };

  async function setup(prefsQuiet: boolean) {
    const t = manualTransport();
    const client = createNotificationClient<Events>({ transport: t.transport });
    const inbox = createInbox({ adapter: memoryAdapter([]) });
    const preferences = createPreferences({
      categories: [
        { id: 'social', label: 'Social' },
        { id: 'muted', label: 'Muted' },
      ],
      channels: [
        { id: 'inApp', label: 'In-app' },
        { id: 'browser', label: 'Browser' },
      ],
      defaults: {
        muted: { muted: true },
        quietHours: { enabled: prefsQuiet, start: '00:00', end: '23:59' },
      },
    });
    render(
      <NotificationProvider
        inbox={inbox}
        client={client}
        preferences={preferences}
        systemNotifications
        documentBadge
        routes={{
          'comment.created': {
            notification: (p) => ({ title: p.text, category: p.category }),
            toast: (p) => ({ title: `Toast: ${p.text}` }),
          },
        }}
      >
        <Toaster />
      </NotificationProvider>,
    );
    await waitFor(() => expect(t.connections).toHaveLength(1));
    act(() => t.current.handlers.onOpen());
    const send = (text: string, category: string) =>
      act(() =>
        t.current.handlers.onMessage({ type: 'comment.created', payload: { text, category } }),
      );
    return { inbox, send };
  }

  it('delivers to inbox, toast, OS notification and tab title', async () => {
    document.title = 'App';
    const { inbox, send } = await setup(false);
    send('Ana replied', 'social');
    expect(Object.values(inbox.getSnapshot().items).map((n) => n.title)).toEqual(['Ana replied']);
    expect(screen.getByText('Toast: Ana replied')).toBeInTheDocument();
    expect(FakeNotification.created.map((n) => n.title)).toEqual(['Ana replied']);
    expect(document.title).toBe('(1) App');
  });

  it('drops muted categories and holds interruptions during quiet hours', async () => {
    const { inbox, send } = await setup(true);
    send('Muted thing', 'muted');
    expect(Object.keys(inbox.getSnapshot().items)).toHaveLength(0);
    send('Quiet thing', 'social');
    expect(Object.values(inbox.getSnapshot().items).map((n) => n.title)).toEqual(['Quiet thing']);
    expect(screen.queryByText('Toast: Quiet thing')).not.toBeInTheDocument();
    expect(FakeNotification.created).toHaveLength(0);
  });
});
