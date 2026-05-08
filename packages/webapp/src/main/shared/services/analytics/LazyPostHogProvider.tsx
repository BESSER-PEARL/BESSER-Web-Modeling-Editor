import React, { useEffect, useState, type ReactNode } from 'react';

interface PostHogProviderProps {
  apiKey: string | undefined;
  options: Record<string, unknown>;
  children: ReactNode;
}

/**
 * A drop-in replacement for `<PostHogProvider>` that lazily loads
 * `posthog-js/react` via dynamic `import()`. Until the module is loaded,
 * children render without a PostHog context -- which is fine because
 * PostHog hooks return safe no-op values when there is no provider.
 */
export const LazyPostHogProvider: React.FC<PostHogProviderProps> = ({ apiKey, options, children }) => {
  const [Provider, setProvider] = useState<React.ComponentType<{ apiKey: string; options: Record<string, unknown>; children: ReactNode }> | null>(null);

  useEffect(() => {
    let cancelled = false;

    import('posthog-js/react')
      .then((mod) => {
        if (!cancelled) {
          // mod.PostHogProvider is the named export
          setProvider(() => mod.PostHogProvider);
        }
      })
      .catch((err) => {
        console.warn('[LazyPostHogProvider] Failed to load posthog-js/react:', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (Provider && apiKey) {
    return (
      <Provider apiKey={apiKey} options={options}>
        {children}
      </Provider>
    );
  }

  // Render children immediately while PostHog loads in background
  return <>{children}</>;
};
