import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  NotificationPreferences,
  PreferencesStore,
  createPreferences,
  isWithinQuietHours,
  localPreferences,
  memoryPreferences,
} from '../../src';

const categories = [
  { id: 'comments', label: 'Comments' },
  { id: 'security', label: 'Security', locked: ['email'] },
  { id: 'marketing', label: 'Marketing', channels: ['email'] },
];
const channels = [
  { id: 'inApp', label: 'In-app' },
  { id: 'email', label: 'Email' },
];

describe('isWithinQuietHours', () => {
  const at = (iso: string) => new Date(iso);

  it('handles same-day and overnight windows in a time zone', () => {
    const day = { enabled: true, start: '09:00', end: '17:00', timeZone: 'UTC' };
    expect(isWithinQuietHours(day, at('2026-06-15T12:00:00Z'))).toBe(true);
    expect(isWithinQuietHours(day, at('2026-06-15T18:00:00Z'))).toBe(false);
    const night = { enabled: true, start: '22:00', end: '07:00', timeZone: 'America/New_York' };
    // 03:00 UTC = 23:00 in New York (EDT)
    expect(isWithinQuietHours(night, at('2026-06-15T03:00:00Z'))).toBe(true);
    // 15:00 UTC = 11:00 in New York
    expect(isWithinQuietHours(night, at('2026-06-15T15:00:00Z'))).toBe(false);
  });

  it('respects days, attributing early-morning hours to the previous night', () => {
    // Friday night only (5). Saturday 02:00 belongs to Friday night.
    const quiet = { enabled: true, start: '22:00', end: '06:00', timeZone: 'UTC', days: [5] };
    expect(isWithinQuietHours(quiet, new Date('2026-06-20T02:00:00Z'))).toBe(true);
    expect(isWithinQuietHours(quiet, new Date('2026-06-21T02:00:00Z'))).toBe(false);
  });

  it('is off when disabled', () => {
    expect(isWithinQuietHours({ enabled: false, start: '00:00', end: '23:59' })).toBe(false);
  });
});

describe('PreferencesStore', () => {
  beforeEach(() => vi.useFakeTimers());

  it('applies channels, locks and mutes', () => {
    const store = new PreferencesStore({ categories, channels });
    expect(store.isEnabled('comments', 'email')).toBe(true);
    store.set('comments', 'email', false);
    expect(store.isEnabled('comments', 'email')).toBe(false);
    store.set('security', 'email', false);
    expect(store.isEnabled('security', 'email')).toBe(true);
    expect(store.isEnabled('marketing', 'inApp')).toBe(false);
    store.mute('comments', true);
    expect(store.isEnabled('comments', 'inApp')).toBe(false);
    expect(store.isEnabled(undefined, 'inApp')).toBe(true);
    expect(store.isEnabled('unknown', 'inApp')).toBe(true);
  });

  it('holds back interruptive deliveries during quiet hours', () => {
    const store = new PreferencesStore({
      categories,
      channels,
      defaults: { quietHours: { enabled: true, start: '00:00', end: '23:59', timeZone: 'UTC' } },
    });
    const noon = new Date('2026-06-15T12:00:00Z');
    expect(store.allows('comments', 'inApp', { date: noon })).toBe(true);
    expect(store.allows('comments', 'inApp', { interruptive: true, date: noon })).toBe(false);
  });

  it('auto-saves after a pause and loads saved values', async () => {
    const adapter = memoryPreferences();
    const store = new PreferencesStore({ categories, channels, adapter, saveDelay: 100 });
    await store.load();
    store.set('comments', 'email', false);
    store.set('comments', 'inApp', false);
    expect(store.getSnapshot().dirty).toBe(true);
    await vi.advanceTimersByTimeAsync(100);
    expect(adapter.saved?.channels.comments).toEqual({ email: false, inApp: false });
    expect(store.getSnapshot().dirty).toBe(false);
    const again = new PreferencesStore({ categories, channels, adapter });
    await again.load();
    expect(again.isEnabled('comments', 'email')).toBe(false);
  });

  it('persists to localStorage', async () => {
    localStorage.clear();
    const store = new PreferencesStore({
      categories,
      channels,
      adapter: localPreferences('test-prefs'),
    });
    store.mute('marketing', true);
    await store.save();
    expect(JSON.parse(localStorage.getItem('test-prefs')!).muted).toEqual({ marketing: true });
  });
});

describe('<NotificationPreferences />', () => {
  it('toggles switches and disables locked ones', async () => {
    const store = createPreferences({ categories, channels, autoSave: false });
    render(<NotificationPreferences store={store} />);
    const commentsEmail = screen.getByRole('switch', { name: 'Comments – Email' });
    expect(commentsEmail).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(commentsEmail);
    expect(commentsEmail).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: 'Security – Email (Required)' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());
  });

  it('edits quiet hours', () => {
    const store = createPreferences({ categories, channels, autoSave: false });
    render(<NotificationPreferences store={store} />);
    const from = screen.getByLabelText('From');
    expect(from).toBeDisabled();
    fireEvent.click(screen.getByRole('switch', { name: 'Quiet hours' }));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '21:30' } });
    expect(store.getSnapshot().values.quietHours).toMatchObject({ enabled: true, start: '21:30' });
  });
});
