// Must stay first: it repairs globalThis.localStorage before any import that
// reads storage while loading (see storage-shim.ts).
import './storage-shim';

import '@testing-library/jest-dom';

// Initialise i18next before any component renders so that t() resolves to real
// (English) strings in unit tests instead of returning raw keys. English is
// bundled, so its translations are available immediately after import.
import i18n from '../main/shared/i18n';
void i18n.changeLanguage('en');

// jsdom has no CSS.escape; browsers do.
if (!globalThis.CSS?.escape) {
  (globalThis as unknown as { CSS: unknown }).CSS = {
    ...globalThis.CSS,
    escape: (value: string) =>
      value.replace(/[\n\r\f]/g, (char) => `\${char.charCodeAt(0).toString(16)} `).replace(/["\'\]]/g, '\$&'),
  };
}
