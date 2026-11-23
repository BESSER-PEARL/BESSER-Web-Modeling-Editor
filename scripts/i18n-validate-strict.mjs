#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const LANGUAGES = ['en', 'es', 'de', 'fr', 'ca', 'lb'];
const I18N_DIR = path.resolve('packages/i18n');
const FILES = ['editor.json', 'webapp.json'];

let hasErrors = false;
const errors = [];

function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      keys.push(...flattenKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

// Load all translation files
const translations = {};
for (const lang of LANGUAGES) {
  translations[lang] = {};
  for (const file of FILES) {
    const filePath = path.join(I18N_DIR, lang, file);
    if (fs.existsSync(filePath)) {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      translations[lang][file] = flattenKeys(content);
    }
  }
}

// Check for missing keys in non-English languages
for (const file of FILES) {
  const enKeys = new Set(translations.en[file] || []);

  for (const lang of LANGUAGES.slice(1)) {
    // Skip English
    const langKeys = new Set(translations[lang][file] || []);
    const missing = [...enKeys].filter((key) => !langKeys.has(key));

    if (missing.length > 0) {
      hasErrors = true;
      errors.push(`❌ ${file} - ${lang}: Missing ${missing.length} key(s):\n   ${missing.join('\n   ')}`);
    }
  }
}

// Check that every t('key', { defaultValue }) in the webapp names a key English has:
// a defaultValue hides a missing key in English and shows English in every other locale.
{
  const enKeys = new Set(FILES.flatMap((file) => translations.en[file] || []));
  const known = (key) => enKeys.has(key) || enKeys.has(`${key}_one`) || enKeys.has(`${key}_other`);
  const sources = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '__tests__') walk(full);
      } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
        sources.push(full);
      }
    }
  };
  walk(path.resolve('packages/webapp/src'));
  const withDefault = /\bt\(\s*(['"])([\w.-]+)\1\s*,\s*\{[^}]*?\bdefaultValue\b/g;
  const missing = [];
  for (const file of sources) {
    for (const match of fs.readFileSync(file, 'utf-8').matchAll(withDefault)) {
      if (!known(match[2])) missing.push(`${match[2]} (${path.relative(process.cwd(), file)})`);
    }
  }
  if (missing.length > 0) {
    hasErrors = true;
    errors.push(`❌ en: ${missing.length} key(s) used with a defaultValue are missing:\n   ${missing.join('\n   ')}`);
  }
}

// Check for stale keys in non-English languages (keys that don't exist in English)
for (const file of FILES) {
  const enKeys = new Set(translations.en[file] || []);

  for (const lang of LANGUAGES.slice(1)) {
    const langKeys = new Set(translations[lang][file] || []);
    const stale = [...langKeys].filter((key) => !enKeys.has(key));

    if (stale.length > 0) {
      console.warn(
        `⚠️  ${file} - ${lang}: Has ${stale.length} stale key(s) not in English:\n   ${stale.join('\n   ')}`,
      );
    }
  }
}

// Print summary
console.log('\n📋 i18n Validation Results:');
console.log('='.repeat(60));

if (errors.length === 0) {
  console.log('✅ All languages have complete translations!\n');
  process.exit(0);
} else {
  console.log('\nErrors found:\n');
  errors.forEach((error) => console.log(error + '\n'));
  console.log('='.repeat(60));
  console.log('\n❌ Translation validation failed! Please add missing translations before merging.\n');
  process.exit(1);
}
