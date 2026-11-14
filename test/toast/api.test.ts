import { ToastStore } from '../../src/toast/store';
import { createToastApi } from '../../src/toast/api';

describe('toast api', () => {
  const setup = () => {
    const store = new ToastStore<string>({ duration: 1000, exitDuration: 0 });
    return { store, toast: createToastApi(store) };
  };

  it('creates typed toasts', () => {
    const { store, toast } = setup();
    toast('plain');
    toast.success('ok');
    toast.error('bad');
    toast.info('fyi');
    toast.warning('careful');
    toast.loading('wait');
    expect(store.getSnapshot().map((t) => t.type)).toEqual([
      'default',
      'success',
      'error',
      'info',
      'warning',
      'loading',
    ]);
  });

  it('updates and dismisses by id', () => {
    const { store, toast } = setup();
    const id = toast('a');
    toast.update(id, { description: 'details' });
    expect(store.getSnapshot()[0]?.description).toBe('details');
    toast.dismiss(id);
    expect(store.getSnapshot()[0]?.state).toBe('leaving');
  });

  it('turns a promise into loading then success', async () => {
    const { store, toast } = setup();
    const result = await toast.promise(Promise.resolve(42), {
      loading: 'Loading',
      success: (n) => `Got ${n}`,
      error: 'Failed',
    });
    expect(result).toBe(42);
    await Promise.resolve();
    expect(store.getSnapshot()[0]).toMatchObject({ type: 'success', title: 'Got 42' });
  });

  it('turns a rejected promise into an error toast', async () => {
    const { store, toast } = setup();
    const promise = toast.promise(() => Promise.reject(new Error('nope')), {
      loading: 'Loading',
      success: 'Done',
      error: (e) => (e as Error).message,
    });
    expect(store.getSnapshot()[0]?.type).toBe('loading');
    await expect(promise).rejects.toThrow('nope');
    await Promise.resolve();
    expect(store.getSnapshot()[0]).toMatchObject({ type: 'error', title: 'nope' });
  });
});
