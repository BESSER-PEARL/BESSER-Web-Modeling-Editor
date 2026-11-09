import { legacyUnprefixedLocalStorageKeys, localStoragePrefix } from '../../constants/constant';

/**
 * Delete every `besser_` localStorage key and the legacy unprefixed ones,
 * projects included. Only for the user's explicit "Reset and reload".
 */
export function clearAppLocalStorage(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(localStoragePrefix)) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
  legacyUnprefixedLocalStorageKeys.forEach((key) => localStorage.removeItem(key));
}
