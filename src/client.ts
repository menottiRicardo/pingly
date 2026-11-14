import type { ReactNode } from 'react';
import { ToastStore } from './store';
import { createToastApi } from './api';

/** The shared store every `<Toaster>` renders from. */
export const store = new ToastStore<ReactNode>();

export const toast = createToastApi(store);
