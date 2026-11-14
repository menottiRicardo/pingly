import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { store } from '../src/client';

afterEach(() => {
  cleanup();
  store.reset();
  vi.useRealTimers();
});
