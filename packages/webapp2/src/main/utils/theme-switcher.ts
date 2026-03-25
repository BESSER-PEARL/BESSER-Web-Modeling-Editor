import { LocalStorageRepository } from '../../main/services/storage/local-storage-repository';
import * as themings from '../themings.json';

export const setTheme = (theming: string) => {
  const root = document.documentElement;
  const themeMap = themings as Record<string, Record<string, string>>;
  const selectedTheme = themeMap[theming];

  if (!selectedTheme) {
    return;
  }

  for (const [themingVar, value] of Object.entries(selectedTheme)) {
    root.style.setProperty(themingVar, value);
  }

  // Keep DOM theme flags in sync for CSS selectors and Tailwind dark variants.
  root.setAttribute('data-theme', theming);
  root.classList.toggle('dark', theming === 'dark');
};

export const toggleTheme = () => {
  let themePreference = LocalStorageRepository.getUserThemePreference();
  // if (!themePreference) themePreference = LocalStorageRepository.getSystemThemePreference();
  if (!themePreference) themePreference = 'light';

  switch (themePreference) {
    case 'dark':
      setTheme('light');
      LocalStorageRepository.setUserThemePreference('light');
      break;

    default:
      setTheme('dark');
      LocalStorageRepository.setUserThemePreference('dark');
      break;
  }
};

export const isDarkThemeEnabled = (): boolean => {
  const preferred = LocalStorageRepository.getUserThemePreference();
  const fallback = LocalStorageRepository.getSystemThemePreference();
  return (preferred || fallback || 'light') === 'dark';
};
