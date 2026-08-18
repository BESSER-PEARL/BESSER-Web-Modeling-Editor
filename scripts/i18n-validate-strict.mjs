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
