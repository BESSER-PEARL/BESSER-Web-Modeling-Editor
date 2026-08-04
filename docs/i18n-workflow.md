# i18n Validation Workflow

This document describes the GitHub Actions workflow that validates internationalization (i18n) completeness before merging PRs to the main branch.

## Overview

The workflow ensures that every English translation key in the i18n JSON files (`packages/i18n/en/`) has corresponding translations in all supported languages:
- 🇪🇸 Spanish (`es`)
- 🇩🇪 German (`de`)
- 🇫🇷 French (`fr`)
- 🇨🇦 Catalan (`ca`)
- 🇱🇺 Luxembourgish (`lb`)

## How It Works

### Automatic Validation
When a PR is opened or updated with changes to:
- `packages/i18n/**` (any i18n JSON file)

The workflow automatically runs and checks:
1. All keys in `en/editor.json` exist in `es/editor.json`, `de/editor.json`, etc.
2. All keys in `en/webapp.json` exist in all other language files
3. Reports missing translations per language

### Failure Conditions
The PR check fails if:
- Any language is missing translation keys that exist in English
- A stale key exists (present in another language but not in English)

### Manual Validation

You can run the validation script locally:

```bash
npm run i18n:validate
```

This will exit with code 1 if any translations are missing, and code 0 if all are complete.

## Adding New Translation Keys

When you add a new hardcoded string to a component:

1. **Create a new key** in `packages/i18n/en/editor.json` (or `webapp.json`)
   ```json
   {
     "packages": {
       "AgentDiagram": {
         "newKey": "English text here"
       }
     }
   }
   ```

2. **Add translations** to all other language files:
   - `packages/i18n/es/editor.json` - Spanish
   - `packages/i18n/de/editor.json` - German
   - `packages/i18n/fr/editor.json` - French
   - `packages/i18n/ca/editor.json` - Catalan
   - `packages/i18n/lb/editor.json` - Luxembourgish

3. **Run validation** locally:
   ```bash
   npm run i18n:validate
   ```

4. **Fix any missing translations** reported by the validator

5. **Commit and push** — the PR check will pass once all translations are in place

## File Structure

- `.github/workflows/i18n-validation.yml` — GitHub Actions workflow definition
- `scripts/i18n-validate-strict.mjs` — Validation script
- `packages/i18n/{lang}/editor.json` — Editor-specific translations
- `packages/i18n/{lang}/webapp.json` — Webapp-specific translations

## Related Scripts

```bash
# Check i18n coverage percentage
npm run i18n:check

# Validate strict completeness (fails if any translations missing)
npm run i18n:validate

# Auto-format all files
npm run prettier:write
```

## Troubleshooting

### PR Check Failing: "Translation validation failed"

**Problem:** You added English keys but forgot to add them to other languages.

**Solution:**
1. Check the error output in the GitHub PR check for which keys and languages are missing
2. Add the missing keys to the corresponding language files
3. Run `npm run i18n:validate` locally to verify
4. Push the fix — the PR check will pass automatically

### Script Returns "Missing X key(s)"

The validation script lists all missing translations. For each missing key:
1. Copy the key structure from `en/editor.json` or `en/webapp.json`
2. Translate the English value into the target language
3. Add it to the corresponding language file
4. Run `npm run i18n:validate` again to verify

### Stale Keys Warning

The validator warns about keys that exist in another language but not in English. These should be removed:
```bash
# Check which keys are stale
npm run i18n:validate

# Manually remove stale keys from the language files
# Then re-run to verify
```

## Integration with CI/CD

The workflow runs automatically on every PR. You do NOT need to manually trigger it. To view results:
1. Open your PR on GitHub
2. Scroll to "Checks" section
3. Click "i18n Validation" to see details
4. If failed, read the error message and fix locally before pushing again

## Notes

- The workflow only validates **completeness** (all English keys translated)
- It does NOT validate **accuracy** of translations
- It does NOT check for typos or grammatical errors
- Human review of translations is recommended before merging
