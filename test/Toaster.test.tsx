import { act, fireEvent, render, screen } from '@testing-library/react';
import { Toaster, toast } from '../src';

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
    const region = screen.getByRole('region', { name: 'Alerts' });
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
