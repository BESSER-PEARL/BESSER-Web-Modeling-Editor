import { useEffect, useState } from 'react';

const isDark = (): boolean => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

/**
 * Whether the page is currently in the dark theme, kept live.
 *
 * `setTheme` (shared/utils/theme-switcher) records the theme as a `dark` class
 * on <html> and does not emit an event, so this watches that class. Components
 * that paint themselves (a canvas, an SVG with literal colours) cannot use the
 * Tailwind `dark:` variants and need to know.
 */
export function useIsDarkTheme(): boolean {
  const [dark, setDark] = useState<boolean>(isDark);

  useEffect(() => {
    const update = () => setDark(isDark());
    update(); // the theme may have changed between render and effect
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => observer.disconnect();
  }, []);

  return dark;
}
