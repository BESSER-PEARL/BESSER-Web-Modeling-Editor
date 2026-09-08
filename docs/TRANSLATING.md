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

All translations live in one shared folder, **`packages/i18n/`**, with a subfolder
per language holding two JSON files — one for each runtime i18n system:

| Resource set | What it covers | File |
|--------------|----------------|------|
| **Webapp shell** | Top bar, menus, sidebar, dialogs, toasts, buttons — everything outside the diagram canvas | `packages/i18n/<lang>/webapp.json` |
| **Editor engine** | Diagram element names, property pop-ups, palette labels inside the canvas | `packages/i18n/<lang>/editor.json` |

So a French translator works entirely inside `packages/i18n/fr/`. Both files use
the same nested-JSON shape. Keys are organised by area, e.g.:

```jsonc
// packages/i18n/fr/webapp.json
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

   Then import and register its resource in `packages/webapp/src/main/shared/i18n/index.ts`:
   - Add a new import line with the other language imports at the top:
     ```ts
     import it from '../../../../../i18n/it/webapp.json';
     ```
   - Add an entry in the `resources` object:
     ```ts
     it: { translation: it },
     ```

3. **Create the files** by copying the English ones:
   - `packages/i18n/en/webapp.json` → `packages/i18n/it/webapp.json`
   - `packages/i18n/en/editor.json` → `packages/i18n/it/editor.json`

4. **Translate the values.** Keep the structure identical to English.

5. **Verify** with `npm run i18n:check` (should report `100.0%` for `it`) and
   `npm run test --workspace=webapp`.

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

There are two different jobs here, and most PRs are one or the other:

- **Track A — you're a feature developer** adding new UI (a new diagram type, a menu, a
  dialog). Your job is to make the new text *translatable in the first place*, then seed the
  other languages.
- **Track B — you're translating** an existing language (filling gaps or fixing wording).

Both end the same way: **machine translation gets you ~90%; a human speaker gets it right.**
Every non-English string must be reviewed by a native/fluent speaker before merge.

### Track A — Feature developers: making new text translatable

The golden rule: **never hardcode a user-facing string.** If you write literal English into a
component, it can never localize — it will show English in every language, silently. Instead,
route it through `t()` (plain text) or `<Trans>` (rich text) with a **key**, and put the actual
English text in `packages/i18n/en/webapp.json`. English is the single source of truth every other
language is translated from; a key with no `en` entry renders the raw key string (e.g.
`dialogs.feedback.title`) in the UI, which is your signal you forgot step 5.

**1. Plain text** — the common case:

```tsx
import { useTranslation } from 'react-i18next';

// ❌ Before — hardcoded, will never translate:
<DialogTitle>Help Us Improve BESSER</DialogTitle>

// ✅ After — the component references a key…
const { t } = useTranslation();
<DialogTitle>{t('dialogs.feedback.title')}</DialogTitle>
```

```jsonc
// …and the English text lives in packages/i18n/en/webapp.json:
"dialogs": { "feedback": { "title": "Help Us Improve BESSER" } }
```

**2. Runtime values (interpolation)** — pass the value as the second argument; put a `{{token}}`
in the JSON string. Every language keeps the token verbatim and only moves it for natural word
order:

```tsx
// label is computed at runtime (e.g. the diagram type name)
t('project.settings.perspectives.toggleAria', { label })
```

```jsonc
"toggleAria": "Toggle {{label}} visibility"   // fr: "Basculer la visibilité de {{label}}"
```

**3. Rich text — bold, links, lists** — use `<Trans>` with a `components` map. Structural
props (a link's `href`/`target`, a span's `className`) live in the map, so the translated
string only carries the human-readable text and lightweight tags:

```tsx
import { Trans } from 'react-i18next';

<Trans
  i18nKey="dialogs.about.para2"
  components={{ brand: <span className="font-semibold text-brand" /> }}
/>
// en value: "The <brand>Web Modeling Editor</brand> is the online visual editor for ..."
```

**4. Module-level data (menus, category lists)** — don't call `t()` at module top level;
i18n isn't initialised yet and you'd freeze the English strings. Instead **store the key and
resolve at render**:

```tsx
// module scope: store i18n KEYS, not resolved text
const categories = [
  { value: 'bug',     labelKey: 'dialogs.feedback.category.bug' },
  { value: 'feature', labelKey: 'dialogs.feedback.category.feature' },
];

// inside the component:
const { t } = useTranslation();
categories.map((c) => <option key={c.value}>{t(c.labelKey)}</option>);
```

**5. Add the English keys (required); the other languages are optional.** Add your new
English keys to `packages/i18n/en/webapp.json` (or the editor
`packages/i18n/en/editor.json` for canvas strings) — **this is mandatory**, because English
is what every other language falls back to. Translating the same keys into the other five
languages is welcome but **optional**: draft them with an LLM (Track B) and get a human
check, or leave them for the BESSER team to complete and review. Then run
`npm run i18n:check`; it must **pass**, which means English is complete and no locale has
stale keys. Untranslated keys in the other languages are reported as warnings, not failures,
and fall back to English at runtime.

> **Tip:** i18next *does* accept an inline English default (`t('key', 'English text')`), but
> this project's convention is **key-only** — all English lives in `en/webapp.json` (and
> `en/editor.json`) as the single source of truth (a quick grep finds ~1000 `t('…')` calls and
> zero inline defaults). Keeping every string in the English files is what lets
> `npm run i18n:check` verify each key is present in English and track coverage for the
> other languages.

### Track B — Translators: filling or fixing a language

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
npm run i18n:check                 # key parity + coverage % for every language (webapp + editor)
npm run test --workspace=webapp    # includes the locale-parity unit test (webapp)
npm run dev                        # run the app and switch languages from the globe menu
```

`i18n:check` exits non-zero if **English is incomplete** or a locale has **extra/stale keys**
(e.g. after renaming a key, or a copy-paste typo). Missing keys in the non-English languages
are reported as **warnings only** — they fall back to English at runtime and don't block a
contribution. To require every language to be 100% (the maintainer/release gate), run the
`--complete` form:

```bash
node scripts/i18n-check.mjs --complete
```

---

## PR checklist

- [ ] Edited only translation **values** (keys unchanged).
- [ ] All `{{placeholders}}` preserved.
- [ ] Product / format names left in English.
- [ ] `npm run i18n:check` passes (English complete, no stale keys). Translating the other
      languages is optional — aim for 100% on any language you touch, but untranslated keys
      only warn. If you renamed or removed keys, fix the resulting extra-key failures.
- [ ] `npm run test --workspace=webapp` passes.
- [ ] Reviewed by a native/fluent speaker — name them or note "self, native speaker" in the PR.
- [ ] For a brand-new language: registered in `editor-types.ts`, `i18n-provider.tsx`,
      `languages.ts`, and `shared/i18n/index.ts`.
