import { Locale } from '@besser/wme';

/**
 * Single source of truth for the languages the editor ships with.
 *
 * To add a language:
 *   1. Add the editor `Locale` enum value (packages/editor/.../editor-types.ts).
 *   2. Add an entry here (code must match the enum value and the locale folder name).
 *   3. Copy `locales/en/translation.json` to `locales/<code>/translation.json` and translate.
 *   4. Copy `packages/editor/src/main/i18n/en.json` to `<code>.json` and translate.
 * See docs/TRANSLATING.md for the full workflow.
 */
export interface SupportedLanguage {
  /** BCP-47 / ISO 639-1 code, e.g. 'fr'. Matches the locale folder and the editor `Locale`. */
  code: string;
  /** Endonym shown in the language selector (the language's own name). */
  nativeName: string;
  /** English name, used for tooltips/accessibility. */
  englishName: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', nativeName: 'English', englishName: 'English' },
  { code: 'lb', nativeName: 'Lëtzebuergesch', englishName: 'Luxembourgish' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German' },
  { code: 'fr', nativeName: 'Français', englishName: 'French' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish' },
  { code: 'ca', nativeName: 'Català', englishName: 'Catalan' },
];

export const DEFAULT_LANGUAGE = 'en';

export const SUPPORTED_LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);

/** localStorage key used by the language detector to persist the user's choice. */
export const LANGUAGE_STORAGE_KEY = 'besser_language';

/**
 * Map an app language code to the editor engine's `Locale`. Codes are identical
 * today, but this keeps the coupling explicit and falls back to English for any
 * language the editor engine does not (yet) translate.
 */
export function toEditorLocale(code: string): Locale {
  return (Object.values(Locale) as string[]).includes(code) ? (code as Locale) : Locale.en;
}
