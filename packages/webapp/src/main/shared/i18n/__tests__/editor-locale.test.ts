import { describe, it, expect } from 'vitest';
import { Locale } from '@besser/wme';

import { SUPPORTED_LANGUAGE_CODES, toEditorLocale } from '../languages';

// The webapp language selector drives the React Flow editor's chrome language
// (BesserEditorComponent passes `toEditorLocale(i18n.language)` at construction
// and sets `editor.locale` on `languageChanged`). Every language the webapp
// offers must therefore exist as an editor `Locale`, or it would silently
// render the canvas in English.
describe('toEditorLocale', () => {
  it('maps every supported webapp language to the same editor locale', () => {
    for (const code of SUPPORTED_LANGUAGE_CODES) {
      expect(toEditorLocale(code)).toBe(code);
    }
    expect([...Object.values(Locale)].sort()).toEqual([...SUPPORTED_LANGUAGE_CODES].sort());
  });

  it('falls back to English for languages the editor does not ship', () => {
    expect(toEditorLocale('it')).toBe(Locale.en);
    expect(toEditorLocale('')).toBe(Locale.en);
  });
});
