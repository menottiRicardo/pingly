import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  Alert,
  Banner,
  BannerHost,
  BannerStore,
  banner,
  bannerStore,
  selectBanners,
} from '../../src';

describe('BannerStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  it('orders by priority, then newest', () => {
    const store = new BannerStore<string>();
    store.show('low');
    vi.advanceTimersByTime(1);
    store.show('high', { priority: 5 });
    vi.advanceTimersByTime(1);
    store.show('newer low');
    expect(selectBanners(store.getSnapshot()).map((b) => b.message)).toEqual([
      'high',
      'newer low',
      'low',
    ]);
  });

  it('remembers dismissals by key', () => {
    const store = new BannerStore<string>();
    const id = store.show('Cookie notice', { dismissKey: 'cookies' });
    store.dismiss(id);
    expect(store.wasDismissed('cookies')).toBe(true);
    store.show('Cookie notice', { dismissKey: 'cookies' });
    expect(store.getSnapshot()).toHaveLength(0);
    store.forget('cookies');
    store.show('Cookie notice', { dismissKey: 'cookies' });
    expect(store.getSnapshot()).toHaveLength(1);
  });
});

describe('<BannerHost />', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  it('shows the highest priority banner and dismisses it', () => {
    render(<BannerHost />);
    act(() => {
      banner.info('Scheduled maintenance');
      banner.error('Payment failed', {
        priority: 10,
        action: { label: 'Update card', onClick: () => {} },
      });
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Payment failed');
    expect(screen.queryByText('Scheduled maintenance')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.getByRole('status')).toHaveTextContent('Scheduled maintenance');
  });

  it('starts and ends banners on schedule', () => {
    render(<BannerHost />);
    const now = Date.now();
    act(() => {
      banner.warning('Flash sale', { startsAt: now + 1000, endsAt: now + 2000 });
    });
    expect(screen.queryByText('Flash sale')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('Flash sale')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByText('Flash sale')).not.toBeInTheDocument();
  });

  it('targets hosts by id', () => {
    render(
      <>
        <BannerHost />
        <BannerHost id="dashboard" />
      </>,
    );
    act(() => {
      banner.success('Only on the dashboard', { hostId: 'dashboard' });
    });
    expect(screen.getAllByText('Only on the dashboard')).toHaveLength(1);
    expect(bannerStore.getSnapshot()[0]?.hostId).toBe('dashboard');
  });
});

describe('<Banner /> and <Alert />', () => {
  it('renders a standalone banner with action and dismiss', () => {
    const onDismiss = vi.fn();
    const onClick = vi.fn();
    render(
      <Banner variant="neutral" action={{ label: 'Learn more', onClick }} onDismiss={onDismiss}>
        New: dark mode
      </Banner>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Learn more' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onClick).toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });

  it('picks the alert role from the variant, with an override', () => {
    const { rerender } = render(<Alert variant="error" title="Upload failed" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Upload failed');
    rerender(<Alert variant="info" title="Heads up" />);
    expect(screen.getByRole('status')).toHaveTextContent('Heads up');
    rerender(<Alert variant="error" title="Static" role="none" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
