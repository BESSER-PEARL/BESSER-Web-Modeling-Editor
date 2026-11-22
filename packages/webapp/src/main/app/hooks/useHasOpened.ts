import { useState } from 'react';

/**
 * Latches to true the first time `open` is true. Gate a lazy dialog on it so its
 * chunk loads on first open, and it stays mounted afterwards for its close animation.
 */
export function useHasOpened(open: boolean): boolean {
  const [hasOpened, setHasOpened] = useState(open);
  if (open && !hasOpened) {
    setHasOpened(true);
  }
  return hasOpened || open;
}
