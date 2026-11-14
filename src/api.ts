import type { ToastStore } from './store';
import type { ToastOptions, ToastUpdate } from './types';

export type TypedToastOptions<C> = Omit<ToastOptions<C>, 'type'>;

export interface PromiseMessages<C, T> {
  loading: C;
  success: C | ((value: T) => C);
  error: C | ((error: unknown) => C);
}

export interface ToastApi<C> {
  (title: C, options?: ToastOptions<C>): string;
  success(title: C, options?: TypedToastOptions<C>): string;
  error(title: C, options?: TypedToastOptions<C>): string;
  info(title: C, options?: TypedToastOptions<C>): string;
  warning(title: C, options?: TypedToastOptions<C>): string;
  loading(title: C, options?: TypedToastOptions<C>): string;
  /**
   * Show a loading toast that turns into a success or error toast when the
   * promise settles. Returns the original promise.
   */
  promise<T>(
    promise: Promise<T> | (() => Promise<T>),
    messages: PromiseMessages<C, T>,
    options?: TypedToastOptions<C>,
  ): Promise<T>;
  update(id: string, patch: ToastUpdate<C>): void;
  dismiss(id?: string): void;
}

export function createToastApi<C>(store: ToastStore<C>): ToastApi<C> {
  const typed =
    (type: NonNullable<ToastOptions<C>['type']>) => (title: C, options?: TypedToastOptions<C>) =>
      store.add(title, { ...options, type });

  const api = ((title: C, options?: ToastOptions<C>) => store.add(title, options)) as ToastApi<C>;
  api.success = typed('success');
  api.error = typed('error');
  api.info = typed('info');
  api.warning = typed('warning');
  api.loading = typed('loading');
  api.update = (id, patch) => store.update(id, patch);
  api.dismiss = (id) => store.dismiss(id);

  api.promise = <T>(
    input: Promise<T> | (() => Promise<T>),
    messages: PromiseMessages<C, T>,
    options?: TypedToastOptions<C>,
  ) => {
    const promise = typeof input === 'function' ? input() : input;
    const id = store.add(messages.loading, { ...options, type: 'loading' });
    const settle = (type: 'success' | 'error', title: C) =>
      store.update(id, { type, title, duration: options?.duration });
    promise.then(
      (value) => settle('success', resolve(messages.success, value)),
      (error: unknown) => settle('error', resolve(messages.error, error)),
    );
    return promise;
  };

  return api;
}

function resolve<C, V>(message: C | ((value: V) => C), value: V): C {
  return typeof message === 'function' ? (message as (value: V) => C)(value) : message;
}
