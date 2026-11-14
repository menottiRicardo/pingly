import { act, fireEvent, render, screen } from '@testing-library/react';
import { Toaster, toast } from '../../src';

describe('<Toaster />', () => {
  beforeEach(() => vi.useFakeTimers());

  it('renders toasts with title, description and type', () => {
    render(<Toaster />);
    act(() => {
      toast.success('Saved', { description: 'All changes stored' });
    });
    const item = screen.getByRole('status');
    expect(item).toHaveTextContent('Saved');
    expect(item).toHaveTextContent('All changes stored');
    expect(item).toHaveAttribute('data-type', 'success');
  });

  it('uses role="alert" for errors', () => {
    render(<Toaster />);
    act(() => {
      toast.error('Something broke');
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Something broke');
  });

  it('exposes a labelled region positioned by props', () => {
    render(<Toaster position="top-center" label="Alerts" />);
    const region = screen.getByRole('region', { name: /^Alerts/ });
    expect(region).toHaveAttribute('data-y', 'top');
    expect(region).toHaveAttribute('data-x', 'center');
  });

  it('auto-dismisses and unmounts after the exit phase', () => {
    render(<Toaster duration={1000} />);
    act(() => {
      toast('Temporary');
    });
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'leaving');
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('pauses while hovered', () => {
    render(<Toaster duration={1000} />);
    act(() => {
      toast('Hover me');
    });
    fireEvent.mouseEnter(screen.getByRole('region'));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'visible');
    fireEvent.mouseLeave(screen.getByRole('region'));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'leaving');
  });

  it('dismisses via the close button and Escape', () => {
    render(<Toaster closeButton />);
    act(() => {
      toast('One');
      toast('Two');
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Close notification' })[0]!);
    const items = screen.getAllByRole('status');
    expect(items.filter((i) => i.dataset.state === 'leaving')).toHaveLength(1);
    const visible = items.find((i) => i.dataset.state === 'visible')!;
    fireEvent.keyDown(visible, { key: 'Escape' });
    expect(visible).toHaveAttribute('data-state', 'leaving');
  });

  it('runs actions and dismisses unless prevented', () => {
    const onClick = vi.fn();
    render(<Toaster />);
    act(() => {
      toast('Deleted', { action: { label: 'Undo', onClick } });
      toast('Kept', {
        action: { label: 'Stay', onClick: (e) => e.preventDefault() },
      });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByText('Deleted').closest('li')).toHaveAttribute('data-state', 'leaving');
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.getByText('Kept').closest('li')).toHaveAttribute('data-state', 'visible');
  });

  it('shows at most `max` toasts', () => {
    render(<Toaster max={2} />);
    act(() => {
      toast('1');
      toast('2');
      toast('3');
    });
    expect(screen.getAllByRole('status').map((i) => i.textContent)).toEqual(['3', '2']);
  });

  it('accepts JSX content', () => {
    render(<Toaster />);
    act(() => {
      toast(<strong>Bold move</strong>);
    });
    expect(screen.getByText('Bold move').tagName).toBe('STRONG');
  });
});

describe('<Toaster /> upgrades', () => {
  beforeEach(() => vi.useFakeTimers());

  it('routes toasts to the toaster with the matching id', () => {
    render(
      <>
        <Toaster label="Main" />
        <Toaster id="side" label="Side" />
      </>,
    );
    act(() => {
      toast('For main');
      toast('For side', { toasterId: 'side' });
    });
    expect(screen.getByRole('region', { name: /^Main/ })).toHaveTextContent('For main');
    expect(screen.getByRole('region', { name: /^Main/ })).not.toHaveTextContent('For side');
    expect(screen.getByRole('region', { name: /^Side/ })).toHaveTextContent('For side');
  });

  it('renders custom toasts and icon overrides', () => {
    render(<Toaster />);
    act(() => {
      toast.custom((id) => <div data-testid="custom">Custom {id}</div>);
      toast('With icon', { icon: <span data-testid="my-icon">★</span> });
      toast.success('No icon', { icon: null });
    });
    expect(screen.getByTestId('custom')).toBeInTheDocument();
    expect(screen.getByTestId('my-icon')).toBeInTheDocument();
    expect(screen.getByText('No icon').closest('li')!.querySelector('.pingly-icon')).toBeNull();
  });

  it('shows a progress bar that pauses with the toaster', () => {
    render(<Toaster progress duration={2000} />);
    act(() => {
      toast('Timed');
    });
    const bar = document.querySelector<HTMLElement>('.pingly-progress')!;
    expect(bar.style.animationDuration).toBe('2000ms');
    fireEvent.mouseEnter(screen.getByRole('region'));
    expect(screen.getByRole('region')).toHaveAttribute('data-paused', 'true');
  });

  it('flags stacked and rich-colors modes', () => {
    render(<Toaster stacked richColors />);
    act(() => {
      toast.success('A');
      toast.error('B');
    });
    const list = document.querySelector('.pingly-list')!;
    expect(list).toHaveAttribute('data-expanded', 'false');
    fireEvent.mouseEnter(screen.getByRole('region'));
    expect(list).toHaveAttribute('data-expanded', 'true');
    expect(screen.getByRole('region')).toHaveAttribute('data-rich-colors', 'true');
    expect(screen.getByText('B').closest('li')).toHaveAttribute('data-index', '0');
  });

  it('focuses the newest toast with the hotkey', () => {
    render(<Toaster />);
    act(() => {
      toast('Focus me');
    });
    fireEvent.keyDown(document, { code: 'KeyT', altKey: true });
    expect(document.activeElement).toBe(screen.getByText('Focus me').closest('li'));
  });

  it('shows a counter for deduped toasts', () => {
    render(<Toaster />);
    act(() => {
      toast('Copied', { dedupeKey: 'copy' });
      toast('Copied', { dedupeKey: 'copy' });
      toast('Copied', { dedupeKey: 'copy' });
    });
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByText('×3')).toBeInTheDocument();
  });

  it('applies classNames and unstyled', () => {
    render(<Toaster unstyled toastClassNames={{ toast: 'my-toast', title: 'my-title' }} />);
    act(() => {
      toast('Plain');
    });
    const li = screen.getByText('Plain').closest('li')!;
    expect(li).toHaveClass('my-toast');
    expect(li).not.toHaveClass('pingly-toast');
    expect(screen.getByText('Plain')).toHaveClass('my-title');
  });
});
