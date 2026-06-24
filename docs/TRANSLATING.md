# Translating the BESSER Web Modeling Editor

The editor is multilingual. Users pick their language from the **globe menu** in the
top bar, and the choice is remembered (stored in `localStorage` under `besser_language`).

English is the **source of truth**. Every other language is compared against it, and any
string a language hasn't translated yet **automatically falls back to English** — so a
partial translation never breaks the UI. This means you can contribute a little or a lot.

We currently ship: **English (`en`)**, **Luxembourgish (`lb`)**, **German (`de`)**,
**French (`fr`)**, **Spanish (`es`)**, **Catalan (`ca`)**.

> **All non-English translations should be reviewed by a native (or fluent) speaker
> before being merged** — including the ones we shipped initially. LLM-assisted drafting
> is welcome, but a human must verify every string. See [Workflow](#recommended-workflow-llm-assisted-human-verified).

---

## Where the strings live

There are two resource sets, both plain JSON, one file per language:

| Resource set | What it covers | Files |
|--------------|----------------|-------|
| **Webapp shell** | Top bar, menus, sidebar, dialogs, toasts, buttons — everything outside the diagram canvas | `packages/webapp/src/main/shared/i18n/locales/<lang>/translation.json` |
| **Editor engine** | Diagram element names, property pop-ups, palette labels inside the canvas | `packages/editor/src/main/i18n/<lang>.json` |

Both use the same nested-JSON shape. Keys are organised by area, e.g.:

```jsonc
// packages/webapp/src/main/shared/i18n/locales/fr/translation.json
{
  "menu": {
    "file": {
      "title": "Fichier",                 // <- translate the VALUE, never the key
      "exportProject": "Exporter le projet"
    }
  }
}
```

---

## Improving an existing language

1. Open the language's two files (webapp + editor, see the table above).
2. Find the key you want to fix (the English file is the reference for what each key means).
3. Edit the **value**. Leave the **key** untouched.
4. Verify (see [Checking your work](#checking-your-work)) and open a PR.

To find what's still untranslated in a language, run `npm run i18n:check` — it lists every
missing key per language. Untranslated keys show the English text in the running app.

---

## Adding a new language

Say you want to add Italian (`it`). Codes are ISO 639-1 (lowercase).

1. **Register the editor locale.** In
   `packages/editor/src/main/services/editor/editor-types.ts`, add `it = 'it',` to the
   `Locale` enum, and register it in `packages/editor/src/main/components/i18n/i18n-provider.tsx`
   (import the new JSON and add it to the `dictionary` map).

2. **Register the webapp language.** In
   `packages/webapp/src/main/shared/i18n/languages.ts`, add an entry to `SUPPORTED_LANGUAGES`:

   ```ts
   { code: 'it', nativeName: 'Italiano', englishName: 'Italian' },
   ```

   Then import and register its resource in `packages/webapp/src/main/shared/i18n/index.ts`
   (add `import it from './locales/it/translation.json';` and an `it: { translation: it }` entry).

3. **Create the files** by copying the English ones:
   - `packages/webapp/src/main/shared/i18n/locales/en/translation.json` → `.../it/translation.json`
   - `packages/editor/src/main/i18n/en.json` → `.../i18n/it.json`

4. **Translate the values.** Keep the structure identical to English.

5. **Verify** with `npm run i18n:check` (should report `100.0%` for `it`) and `npm run test`.

That's it — the language now appears in the top-bar selector automatically.

---

## Rules of thumb

- **Translate values, not keys.** `"title": "..."` — only the right-hand side changes.
- **Keep placeholders intact.** `{{name}}` is filled in at runtime; copy it verbatim and
  reposition it for natural word order, e.g. `"githubAccount": "Compte GitHub : {{name}}"`.
- **Don't translate proper nouns / technical formats.** BESSER, GitHub, Render, Django,
  SQL DDL, PyTorch, Qiskit, BPMN, OCL, JSON, etc. stay as-is. When in doubt, match what the
  other shipped languages do.
- **Mind the length.** Buttons and menu items are tight. Prefer the concise, conventional
  term over a literal translation.
- **Stay consistent.** Use the same term for the same concept everywhere (e.g. always
  "diagramme de classes", not sometimes "diagramme de classe"). A short glossary helps —
  see below.
- **Match the source register/punctuation.** If English ends with `...` or `?`, keep it.

### Mini glossary (extend as needed)

| English | de | fr | es | ca | lb |
|---------|----|----|----|----|----|
| Class | Klasse | Classe | Clase | Classe | Klass |
| Association | Assoziation | Association | Asociación | Associació | Associatioun |
| Diagram | Diagramm | Diagramme | Diagrama | Diagrama | Diagramm |
| Project | Projekt | Projet | Proyecto | Projecte | Projet |
| Deploy | Bereitstellen | Déployer | Desplegar | Desplega | Deployen |

---

## Recommended workflow (LLM-assisted, human-verified)

Machine translation gets you 90% of the way; a human gets it right.

1. **Draft with an LLM.** Paste the English JSON and ask for a translation that *keeps the
   JSON keys and `{{placeholders}}` unchanged* and *leaves product/format names in English*.
2. **Human review (required).** A native or fluent speaker reads every string in context:
   - Correct terminology for software/UML concepts in that language.
   - Natural phrasing, not word-for-word.
   - Placeholders present and correctly positioned.
   - Nothing too long for its button/menu.
3. **Run it in the app** (`npm run dev`), switch to the language, and click through the
   menus, dialogs, and the diagram canvas.
4. **Open a PR** and note the review status (see checklist).

---

## Checking your work

```bash
npm run i18n:check    # key parity + coverage % for every language (webapp + editor)
npm run test          # includes the locale-parity unit test (webapp)
npm run dev           # run the app and switch languages from the globe menu
```

`i18n:check` exits non-zero if a language is missing keys, and `--strict`
(`node scripts/i18n-check.mjs --strict`) also fails on stray/extra keys.

---

## PR checklist

- [ ] Edited only translation **values** (keys unchanged).
- [ ] All `{{placeholders}}` preserved.
- [ ] Product / format names left in English.
- [ ] `npm run i18n:check` passes (target 100% for the language you touched).
- [ ] `npm run test` passes.
- [ ] Reviewed by a native/fluent speaker — name them or note "self, native speaker" in the PR.
- [ ] For a brand-new language: registered in `editor-types.ts`, `i18n-provider.tsx`,
      `languages.ts`, and `shared/i18n/index.ts`.
