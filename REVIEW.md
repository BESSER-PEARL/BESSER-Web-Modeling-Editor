# Review instructions

These rules apply to automated pull request review. Project conventions live in `CLAUDE.md`; read it as the
reference for every finding below.

## What this review enforces

A change must fit the codebase as it already is. Grade it against this repository's existing patterns, not a
generic React best-practice rubric.

- **Follow the existing convention.** When the codebase already has a way to do something, a new but equivalent
  way is a finding: `shared/api/api-client.ts` for backend calls, `app/store/hooks.ts` for Redux,
  `shared/constants/constant.ts` for storage keys, `react-i18next` for user-facing strings, Tailwind and Radix
  UI for styling and primitives.
- **No papering over.** Flag a client-side workaround for what is really a backend contract issue, an empty
  `catch` that swallows an error, a new `ts-ignore` or `any` used to silence a real type mismatch, a duplicated
  helper instead of an import, and a test made to pass by loosening its assertion.
- **Prefer deletion.** If a new code path does the job of an old one that is still there, ask why both exist.
- **Cite the canonical example.** A convention finding names the file that shows the correct pattern. If you
  cannot point to one, do not post the finding.

## What Important means here

Important is for findings that break behavior, a contract, or a security rule:

- incorrect logic, crashes, lost user work (diagram or project data not saved, overwritten, or not migrated)
- any break of the "Security rules (AI features)" in `CLAUDE.md`: an agent-controlled payload setting a
  privilege flag such as `planApproved`, side-effect actions honored from prose-scraped JSON, an API key outside
  `sessionStorage`, in Redux, or in a log, or a hardcoded server-owned limit
- secrets or tab-scoped state written to `localStorage`
- a feature in `src/main/features/` importing from another feature, or `shared/` importing from `features/`
- a backend endpoint or response shape used without the matching change in `shared/api/` (or the reverse)
- `editorRevision` bumped for a model update or a view-only toggle (it remounts the editor and clears undo)
- a storage write from a thunk without `withoutNotify()`

Cosmetic convention breaks, naming, and style are Nit at most.

## Always check

- **New diagram element or type**: every registration step listed under "Adding a Diagram Element" /
  "Adding a Diagram Type" in `CLAUDE.md` is present. A type also has to exist in the modeling-agent's
  `SUPPORTED_DIAGRAM_TYPES`; say so in the review when it is new.
- **Path aliases**: a change to one of `tsconfig.json`, `vite.config.ts`, `vitest.config.ts` is mirrored in the
  other two.
- **User-facing strings**: go through `react-i18next`, with the key added to `packages/i18n/en/webapp.json`.
- **Tests**: user-visible behavior changes come with a Vitest test next to the code (`__tests__/`) or a
  Playwright test in `packages/webapp/tests/e2e/`. `packages/editor` has no runnable tests, so editor changes
  need webapp coverage.
- **Assistant wire protocol** (`features/assistant/`): action names and payload fields match what the
  modeling-agent emits; new actions are added to both `KNOWN_ACTIONS` and the `AssistantActionName` union.

## Do not report

- `package-lock.json` and other lockfiles, `build/`, and non-English bundles under `packages/i18n/` (CI's i18n
  checks cover translation coverage).
- ESLint warnings: the config is permissive by design (`any` and `ts-ignore` are warnings). Report only new
  errors, or a warning that hides a real bug.
- Items listed under "Known Rough Edges" in `CLAUDE.md`, unless the pull request touches them.
- Generic advice such as "consider memoizing" or "consider more tests" without a concrete path.

## Cap the nits

Report at most five Nits per review.
