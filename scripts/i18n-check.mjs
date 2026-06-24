#!/usr/bin/env node
/**
 * i18n coverage checker for the BESSER Web Modeling Editor.
 *
 * Compares every locale against English (the source of truth) for both
 * translation resource sets:
 *   - webapp shell:  packages/webapp/src/main/shared/i18n/locales/<lang>/translation.json
 *   - editor engine: packages/editor/src/main/i18n/<lang>.json
 *
 * Reports, per language: missing keys (present in English, absent here — these
 * fall back to English at runtime) and extra keys (present here but not in
 * English — usually a typo or a stale key). Prints a coverage percentage.
 *
 * Exit code 1 if any locale is missing keys, so it can gate CI. Run with
 * `--strict` to also fail on extra keys.
 *
 * Usage: node scripts/i18n-check.mjs [--strict]
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STRICT = process.argv.includes('--strict');

// Keep in sync with packages/webapp/src/main/shared/i18n/languages.ts
const LANGUAGES = ['en', 'lb', 'de', 'fr', 'es', 'ca'];
const REFERENCE = 'en';

const RESOURCE_SETS = [
  {
    name: 'webapp',
    path: (lang) => join(ROOT, 'packages/webapp/src/main/shared/i18n/locales', lang, 'translation.json'),
  },
  {
    name: 'editor',
    path: (lang) => join(ROOT, 'packages/editor/src/main/i18n', `${lang}.json`),
  },
];

/** Recursively collect dotted key paths of every leaf string. */
function flatten(obj, prefix = '', out = new Set()) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out.add(path);
    }
  }
  return out;
}

function loadKeys(filePath) {
  if (!existsSync(filePath)) return null;
  return flatten(JSON.parse(readFileSync(filePath, 'utf8')));
}

let hadMissing = false;
let hadExtra = false;

for (const set of RESOURCE_SETS) {
  const refKeys = loadKeys(set.path(REFERENCE));
  if (!refKeys) {
    console.error(`\n[${set.name}] reference locale "${REFERENCE}" not found — skipping`);
    continue;
  }
  console.log(`\n=== ${set.name} (${refKeys.size} keys in ${REFERENCE}) ===`);

  for (const lang of LANGUAGES) {
    if (lang === REFERENCE) continue;
    const keys = loadKeys(set.path(lang));
    if (!keys) {
      console.log(`  ${lang}: MISSING FILE`);
      hadMissing = true;
      continue;
    }
    const missing = [...refKeys].filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => !refKeys.has(k));
    const coverage = (((refKeys.size - missing.length) / refKeys.size) * 100).toFixed(1);
    const status = missing.length === 0 ? 'OK ' : '!! ';
    console.log(`  ${status}${lang}: ${coverage}% (${refKeys.size - missing.length}/${refKeys.size})`);
    if (missing.length) {
      hadMissing = true;
      console.log(`      missing: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ` … (+${missing.length - 10})` : ''}`);
    }
    if (extra.length) {
      hadExtra = true;
      console.log(`      extra:   ${extra.slice(0, 10).join(', ')}${extra.length > 10 ? ` … (+${extra.length - 10})` : ''}`);
    }
  }
}

if (hadMissing) {
  console.error('\n✗ Some locales are missing keys (they fall back to English at runtime).');
  process.exit(1);
}
if (hadExtra && STRICT) {
  console.error('\n✗ Some locales have extra keys not present in English (--strict).');
  process.exit(1);
}
console.log('\n✓ All locales cover every English key.');
