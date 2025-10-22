import { LocalStorageRepository } from '../../main/services/local-storage/local-storage-repository';
import * as themings from '../themings.json';

export const setTheme = (theming: string) => {
  const root = document.documentElement;
  // @ts-ignore
  for (const themingVar of Object.keys(themings[theming])) {
    // @ts-ignore
    root.style.setProperty(themingVar, themings[theming][themingVar]);
  }
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
