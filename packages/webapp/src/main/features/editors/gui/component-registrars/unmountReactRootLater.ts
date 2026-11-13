import type { Root } from 'react-dom/client';

/**
 * Unmounts a view's React root on the next task. GrapesJS removes views while
 * React is committing (editor.destroy() runs in an effect cleanup), where a
 * synchronous root.unmount() makes React warn about a race.
 */
export const unmountReactRootLater = (view: { __reactRoot?: Root | null }): void => {
  const root = view.__reactRoot;
  if (!root) return;
  view.__reactRoot = null;
  setTimeout(() => root.unmount(), 0);
};
