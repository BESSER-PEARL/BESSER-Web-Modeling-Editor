import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';
import { loadLocale } from '@besser/wme';

import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGE_CODES, toEditorLocale } from './languages';

import en from '../../../../../i18n/en/webapp.json';

/**
 * react-i18next initialisation for the webapp shell (everything outside the
 * diagramming canvas). The editor engine keeps its own lightweight i18n; the
 * two are kept in sync by `ApollonEditorComponent` reacting to `languageChanged`.
 *
 * English is the source of truth and the fallback: any key missing from another
 * locale renders the English string, so partial translations never break the UI.
 *
 * Only English is bundled. Every other language is its own chunk, fetched
 * together with the editor engine's labels when it becomes active. i18next
 * emits `languageChanged` only after that load, so a switch never shows
 * untranslated keys. `i18nReady` resolves once the detected language is loaded.
 */
export const i18nReady = i18n
  .use(
    resourcesToBackend(async (language: string) => {
      const [webapp] = await Promise.all([
        import(`../../../../../i18n/${language}/webapp.json`),
        loadLocale(toEditorLocale(language)),
      ]);
      return webapp;
    }),
  )
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en } },
    partialBundledLanguages: true, // bundled English + backend for the rest
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
