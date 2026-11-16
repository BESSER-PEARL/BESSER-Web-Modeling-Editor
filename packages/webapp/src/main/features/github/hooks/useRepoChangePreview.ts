/** Whether the canvas shows what is new on GitHub; opened from the teammate card and the GitHub menu. */
import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set<() => void>();

const setOpen = (next: boolean) => {
  if (open === next) return;
  open = next;
  listeners.forEach((listener) => listener());
};

export const openRepoChangePreview = () => setOpen(true);
export const closeRepoChangePreview = () => setOpen(false);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useRepoChangePreviewOpen = () => useSyncExternalStore(subscribe, () => open);
