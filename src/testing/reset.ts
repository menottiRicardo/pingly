import { bannerStore } from '../banner/instance';
import { store as toastStore } from '../toast/instance';

/** Clear every global pingly store (toasts, banners). Call it between tests. */
export function resetPingly(): void {
  toastStore.reset();
  bannerStore.clear();
}
