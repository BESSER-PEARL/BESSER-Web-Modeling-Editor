import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGE_CODES } from './languages';

import en from './locales/en/translation.json';
import lb from './locales/lb/translation.json';
import de from './locales/de/translation.json';
import fr from './locales/fr/translation.json';
import es from './locales/es/translation.json';
import ca from './locales/ca/translation.json';

/**
 * react-i18next initialisation for the webapp shell (everything outside the
 * diagramming canvas). The editor engine keeps its own lightweight i18n; the
 * two are kept in sync by `ApollonEditorComponent` reacting to `languageChanged`.
 *
 * English is the source of truth and the fallback: any key missing from another
 * locale renders the English string, so partial translations never break the UI.
 */
export const resources = {
  en: { translation: en },
  lb: { translation: lb },
  de: { translation: de },
  fr: { translation: fr },
  es: { translation: es },
  ca: { translation: ca },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGE_CODES,
    nonExplicitSupportedLngs: true, // 'de-DE' -> 'de'
    load: 'languageOnly',
    returnEmptyString: false, // empty value falls back to English
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  });

export default i18n;
