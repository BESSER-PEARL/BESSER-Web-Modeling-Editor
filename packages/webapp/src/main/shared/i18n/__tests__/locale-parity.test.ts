import { describe, it, expect } from 'vitest';

import en from '../locales/en/translation.json';
import lb from '../locales/lb/translation.json';
import de from '../locales/de/translation.json';
import fr from '../locales/fr/translation.json';
import es from '../locales/es/translation.json';
import ca from '../locales/ca/translation.json';

import { SUPPORTED_LANGUAGE_CODES } from '../languages';

/** Collect dotted key paths of every leaf string in a translation tree. */
function flatten(obj: Record<string, unknown>, prefix = '', out: string[] = []): string[] {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value as Record<string, unknown>, path, out);
    } else {
      out.push(path);
    }
  }
  return out;
}

const locales: Record<string, Record<string, unknown>> = { en, lb, de, fr, es, ca };
const enKeys = flatten(en as Record<string, unknown>).sort();

describe('webapp i18n locale parity', () => {
  it('declares exactly the locales that ship with translation files', () => {
    expect([...SUPPORTED_LANGUAGE_CODES].sort()).toEqual(Object.keys(locales).sort());
  });

  for (const [code, dict] of Object.entries(locales)) {
    if (code === 'en') continue;

    it(`"${code}" has no missing keys (every English key is translated)`, () => {
      const keys = new Set(flatten(dict as Record<string, unknown>));
      const missing = enKeys.filter((k) => !keys.has(k));
      expect(missing, `missing keys in ${code}`).toEqual([]);
    });

    it(`"${code}" has no extra keys (no stale or mistyped keys)`, () => {
      const keys = flatten(dict as Record<string, unknown>).sort();
      const extra = keys.filter((k) => !enKeys.includes(k));
      expect(extra, `extra keys in ${code}`).toEqual([]);
    });
  }
});
