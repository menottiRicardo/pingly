import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { bannerStore } from '../src/banner/instance';
import { store } from '../src/toast/instance';

afterEach(() => {
  cleanup();
  store.reset();
  bannerStore.clear();
  vi.useRealTimers();
});
