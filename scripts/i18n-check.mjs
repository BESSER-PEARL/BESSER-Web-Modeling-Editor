#!/usr/bin/env node
/**
 * i18n coverage checker for the BESSER Web Modeling Editor.
 *
 * Compares every locale against English (the source of truth) for both
 * translation resource sets:
 *   - webapp shell:  packages/i18n/<lang>/webapp.json
 *   - editor engine: packages/i18n/<lang>/editor.json
 *
 * Policy (see CONTRIBUTING.md and docs/TRANSLATING.md):
 *   English is REQUIRED and complete — it is the reference every other language
 *   falls back to at runtime. The other languages are OPTIONAL: a contributor
 *   may translate them or leave them for the BESSER team to complete and review.
 *
 * Reports, per language:
 *   - missing keys (present in English, absent here) — these fall back to English
 *     at runtime. Reported as a WARNING; they do NOT fail the check by default.
 *   - extra keys (present here but not in English) — usually a typo or a stale
 *     key. These DO fail the check (cheap guard against mistakes).
 *
 * Exit code 1 when:
 *   - the English reference file is missing or unreadable, or
 *   - any locale has extra/stale keys, or
 *   - `--complete` is passed and any locale is missing keys.
 *
 * Use `--complete` (release/maintenance) to also require every language to be
 * 100% — that is the BESSER team's full-parity gate, not the contributor bar.
 *
 * When run inside GitHub Actions (GITHUB_ACTIONS=true) it additionally:
 *   - emits ::warning:: / ::error:: annotations (shown in the PR "Checks" tab), and
 *   - writes a coverage table to the run's job summary ($GITHUB_STEP_SUMMARY).
 * Both are no-ops locally, so the console output is unchanged outside CI.
 *
 * Usage: node scripts/i18n-check.mjs [--complete]
 */
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// `--complete` (preferred) requires full parity; `--strict` kept as a legacy alias.
const REQUIRE_COMPLETE = process.argv.includes('--complete') || process.argv.includes('--strict');

const IN_GHA = process.env.GITHUB_ACTIONS === 'true';
const SUMMARY_FILE = process.env.GITHUB_STEP_SUMMARY;

// Keep in sync with packages/webapp/src/main/shared/i18n/languages.ts
const LANGUAGES = ['en', 'lb', 'de', 'fr', 'es', 'ca'];
const REFERENCE = 'en';

const RESOURCE_SETS = [
  {
    name: 'webapp',
    path: (lang) => join(ROOT, 'packages/i18n', lang, 'webapp.json'),
  },
  {
    name: 'editor',
    path: (lang) => join(ROOT, 'packages/i18n', lang, 'editor.json'),
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

// GitHub Actions annotation helpers — no-ops outside CI. Messages must be single-line.
function ghaWarning(msg) {
  if (IN_GHA) console.log(`::warning title=i18n::${msg}`);
}
function ghaError(msg) {
  if (IN_GHA) console.log(`::error title=i18n::${msg}`);
}

let hadReferenceError = false; // English missing/unreadable — always fatal
let hadExtra = false; // stale/typo keys — always fatal
let hadMissing = false; // non-English gaps — warning, fatal only with --complete

// Aggregate per language across both resource sets, for the annotations + summary.
const perLang = new Map();
const acc = (lang) => {
  if (!perLang.has(lang)) perLang.set(lang, { refTotal: 0, missingTotal: 0, extraTotal: 0, fileMissing: false });
  return perLang.get(lang);
};

for (const set of RESOURCE_SETS) {
  const refKeys = loadKeys(set.path(REFERENCE));
  if (!refKeys) {
    console.error(`\n[${set.name}] reference locale "${REFERENCE}" not found — English is required.`);
    ghaError(`English reference file missing for "${set.name}" — English translations are required.`);
    hadReferenceError = true;
    continue;
  }
  console.log(`\n=== ${set.name} (${refKeys.size} keys in ${REFERENCE}) ===`);

  for (const lang of LANGUAGES) {
    if (lang === REFERENCE) continue;
    const a = acc(lang);
    a.refTotal += refKeys.size;

    const keys = loadKeys(set.path(lang));
    if (!keys) {
      // A missing non-English file just means that language isn't provided yet.
      console.log(`  -- ${lang}: not provided (falls back to English)`);
      a.fileMissing = true;
      a.missingTotal += refKeys.size;
      hadMissing = true;
      continue;
    }
    const missing = [...refKeys].filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => !refKeys.has(k));
    a.missingTotal += missing.length;
    a.extraTotal += extra.length;
    const coverage = (((refKeys.size - missing.length) / refKeys.size) * 100).toFixed(1);
    const status = missing.length === 0 ? 'OK ' : '.. ';
    console.log(`  ${status}${lang}: ${coverage}% (${refKeys.size - missing.length}/${refKeys.size})`);
    if (missing.length) {
      hadMissing = true;
      console.log(`      missing: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ` … (+${missing.length - 10})` : ''}`);
    }
    if (extra.length) {
      hadExtra = true;
      console.log(`      extra:   ${extra.slice(0, 10).join(', ')}${extra.length > 10 ? ` … (+${extra.length - 10})` : ''}`);
      ghaError(
        `${set.name}/${lang}: ${extra.length} key(s) not in English (stale or mistyped) — e.g. ${extra.slice(0, 5).join(', ')}`,
      );
    }
  }
}

// Per-language coverage annotations for missing keys (aggregated across both sets).
for (const lang of LANGUAGES) {
  if (lang === REFERENCE) continue;
  const a = perLang.get(lang);
  if (!a || a.missingTotal === 0) continue;
  const cov = a.refTotal ? (((a.refTotal - a.missingTotal) / a.refTotal) * 100).toFixed(1) : '0.0';
  const detail = `${lang}: ${cov}% translated — ${a.missingTotal} key(s) fall back to English`;
  if (REQUIRE_COMPLETE) {
    ghaError(`${detail} (--complete requires full parity)`);
  } else {
    ghaWarning(`${detail} (optional; the BESSER team can complete these)`);
  }
}

// Job summary table (GitHub Actions run summary page).
if (SUMMARY_FILE) {
  const lines = [];
  lines.push('## 🌐 Translation coverage');
  lines.push('');
  lines.push(
    'English (`en`) is the source of truth and is **required**. The other languages are ' +
      'optional and fall back to English at runtime.',
  );
  lines.push('');
  lines.push(hadReferenceError ? '**English:** ❌ reference files missing' : '**English:** ✅ complete');
  lines.push('');
  lines.push('| Language | Coverage | Missing | Stale |');
  lines.push('| -------- | -------: | ------: | ----: |');
  for (const lang of LANGUAGES) {
    if (lang === REFERENCE) continue;
    const a = perLang.get(lang);
    if (!a) continue;
    const cov = a.refTotal ? (((a.refTotal - a.missingTotal) / a.refTotal) * 100).toFixed(1) : '—';
    lines.push(`| ${lang} | ${cov}% | ${a.missingTotal} | ${a.extraTotal} |`);
  }
  lines.push('');
  if (hadExtra) {
    lines.push('❌ **Stale/typo keys detected** — these fail the check. Rename or remove them to match English.');
  } else if (hadMissing && REQUIRE_COMPLETE) {
    lines.push('❌ `--complete` requires every language at 100%.');
  } else if (hadMissing) {
    lines.push(
      'ℹ️ Missing keys are allowed — they fall back to English. Providing English only is fine; ' +
        'the BESSER team can complete the other languages.',
    );
  } else {
    lines.push('✅ All languages fully translated.');
  }
  lines.push('');
  appendFileSync(SUMMARY_FILE, lines.join('\n') + '\n');
}

if (hadReferenceError) {
  console.error('\n✗ English reference file missing or unreadable — English translations are required.');
  process.exit(1);
}
if (hadExtra) {
  console.error('\n✗ Some locales have extra keys not present in English (likely a typo or a stale key).');
  process.exit(1);
}
if (hadMissing && REQUIRE_COMPLETE) {
  console.error('\n✗ Some locales are missing keys and --complete requires full parity.');
  process.exit(1);
}
if (hadMissing) {
  console.warn(
    '\n⚠ Some locales are missing keys — they fall back to English at runtime. ' +
      'This is allowed: English is required, other languages are optional and the BESSER team can complete them.',
  );
  console.log('✓ English is complete and no locale has stale keys.');
} else {
  console.log('\n✓ All locales cover every English key.');
}
