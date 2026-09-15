import { describe, it, expect } from 'vitest';

import en from '../../../../../../i18n/en/webapp.json';
import lb from '../../../../../../i18n/lb/webapp.json';
import de from '../../../../../../i18n/de/webapp.json';
import fr from '../../../../../../i18n/fr/webapp.json';
import es from '../../../../../../i18n/es/webapp.json';
import ca from '../../../../../../i18n/ca/webapp.json';

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

// Policy (see CONTRIBUTING.md / docs/TRANSLATING.md): English is required and is
// the reference every other language falls back to at runtime. The other
// languages are OPTIONAL — a contributor may translate them or leave them for the
// BESSER team to complete. So missing (untranslated) keys are a warning, not a
// failure. Extra/stale keys ARE a failure (cheap guard against typos). Set
// I18N_REQUIRE_COMPLETE=1 to also fail on missing keys (the team's full-parity gate).
const REQUIRE_COMPLETE = !!process.env.I18N_REQUIRE_COMPLETE;

describe('webapp i18n locale parity', () => {
  it('declares exactly the locales that ship with translation files', () => {
    expect([...SUPPORTED_LANGUAGE_CODES].sort()).toEqual(Object.keys(locales).sort());
  });

  it('ships a non-empty English reference (English is required)', () => {
    expect(enKeys.length).toBeGreaterThan(0);
  });

  for (const [code, dict] of Object.entries(locales)) {
    if (code === 'en') continue;

    it(`"${code}" translations are a subset of English (no stale or mistyped keys)`, () => {
      const keys = flatten(dict as Record<string, unknown>).sort();
      const extra = keys.filter((k) => !enKeys.includes(k));
      expect(extra, `extra keys in ${code}`).toEqual([]);
    });

    // Full-parity gate: only runs (and asserts) when I18N_REQUIRE_COMPLETE=1.
    // Otherwise it is skipped, never a green no-op. Missing keys fall back to
    // English at runtime, so they are optional outside this explicit gate.
    it.runIf(REQUIRE_COMPLETE)(`"${code}" is fully translated (all English keys present)`, () => {
      const keys = new Set(flatten(dict as Record<string, unknown>));
      const missing = enKeys.filter((k) => !keys.has(k));
      expect(missing, `missing keys in ${code}`).toEqual([]);
    });
  }
});
