import React, { useEffect, type ReactNode } from 'react';
import { setPostHogModule } from './lazy-analytics';

interface PostHogProviderProps {
  apiKey: string | undefined;
  options: Record<string, unknown>;
  children: ReactNode;
}

/**
 * Initializes PostHog lazily without wrapping children in a React PostHogProvider.
 *
 * The old approach (conditionally wrapping children in <PostHogProvider> once the
 * module loaded) caused React to remount the entire child tree on the parent-type
 * change, resetting all component state (dialogs open, etc.).
 *
 * Instead, posthog.init() is called directly via dynamic import and the instance
 * is registered through setPostHogModule() so getPostHog() works everywhere.
 * No components in this codebase use the usePostHog() hook, so no React context
 * is needed.
 */
export const LazyPostHogProvider: React.FC<PostHogProviderProps> = ({ apiKey, options, children }) => {
  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;

    import('posthog-js')
      .then((mod) => {
        if (!cancelled) {
          mod.default.init(apiKey, options as Parameters<typeof mod.default.init>[1]);
          setPostHogModule(mod);
        }
      })
      .catch((err) => {
        console.warn('[LazyPostHogProvider] Failed to load posthog-js:', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Always render children in a stable Fragment — never change the parent type.
  return <>{children}</>;
};
