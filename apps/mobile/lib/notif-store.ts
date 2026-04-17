import type { ApiNotification } from '@/lib/api';

/** Tiny module-level store for passing the selected notification to the detail screen. */
let _current: ApiNotification | null = null;

export const notifStore = {
  set: (n: ApiNotification) => {
    _current = n;
  },
  get: () => _current,
  clear: () => {
    _current = null;
  },
};
