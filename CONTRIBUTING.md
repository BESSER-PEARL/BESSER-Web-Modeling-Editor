# Contributing to the BESSER Web Modeling Editor

First — **thank you** for your interest in contributing to the BESSER Web
Modeling Editor (WME)! ❤️

This repository hosts the WME frontend (webapp + standalone server) and the
core diagramming engine (`packages/editor`, published as `@besser/wme`). The
BESSER backend (metamodels, generators, editor backend) lives in
[BESSER-PEARL/BESSER](https://github.com/BESSER-PEARL/BESSER), and this repo
is also vendored into the backend as a git submodule at
`besser/utilities/web_modeling_editor/frontend`.

This guide explains how to get set up, how we collaborate, and what we
expect from every contribution.

---

## 📑 Table of Contents

- [Contributing to the BESSER Web Modeling Editor](#contributing-to-the-besser-web-modeling-editor)
  - [📑 Table of Contents](#-table-of-contents)
  - [📋 Before You Start](#-before-you-start)
  - [🤝 Ways to Contribute](#-ways-to-contribute)
  - [🧠 Asking Questions](#-asking-questions)
  - [🐞 Reporting Issues \& Requesting Features](#-reporting-issues--requesting-features)
  - [🍴 Setting Up Your Development Environment](#-setting-up-your-development-environment)
    - [Prerequisites](#prerequisites)
    - [Fork, clone, and install](#fork-clone-and-install)
    - [Run the dev server](#run-the-dev-server)
    - [Useful commands](#useful-commands)
  - [🗂️ Repository Tour](#️-repository-tour)
  - [💻 Development Guidelines](#-development-guidelines)
    - [Code style](#code-style)
    - [Feature isolation](#feature-isolation)
    - [Path aliases](#path-aliases)
    - [State management](#state-management)
    - [API communication](#api-communication)
    - [Adding a new diagram element](#adding-a-new-diagram-element)
    - [Adding a new diagram type](#adding-a-new-diagram-type)
  - [✅ Testing Your Changes](#-testing-your-changes)
    - [Lint \& format](#lint--format)
    - [Unit tests (Vitest, jsdom)](#unit-tests-vitest-jsdom)
    - [End-to-end tests (Playwright)](#end-to-end-tests-playwright)
    - [Build](#build)
  - [🧾 Documentation Updates](#-documentation-updates)
  - [🌿 Branching \& Commits](#-branching--commits)
    - [Branch naming](#branch-naming)
    - [Commit conventions](#commit-conventions)
  - [🔀 Creating Pull Requests](#-creating-pull-requests)
    - [Target branch](#target-branch)
    - [Step-by-step](#step-by-step)
    - [Writing a good PR description](#writing-a-good-pr-description)
      - [Tips](#tips)
    - [Review \& merging](#review--merging)
  - [🔗 Cross-Repo Changes (BESSER Backend)](#-cross-repo-changes-besser-backend)
  - [🧭 Governance](#-governance)
  - [💖 Thank You!](#-thank-you)

---

## 📋 Before You Start

- Read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).
- Familiarize yourself with the [project governance model](GOVERNANCE.md).
- Skim the
  [WME documentation site](https://besser.readthedocs.io/projects/besser-web-modeling-editor/)
  for background and editor concepts.
- Try the live editor at https://editor.besser-pearl.org/ to understand the
  end-user experience before changing it.

---

## 🤝 Ways to Contribute

You don't need to be a TypeScript expert to help. Useful contributions
include:

- **Code** — new diagram types, editor improvements, UI features, bug fixes,
  performance work, refactors.
- **Documentation** — clarifying existing pages under `docs/source/`,
  fixing typos, writing tutorials, adding screenshots.
- **Tests** — improving Vitest unit coverage and Playwright end-to-end
  scenarios.
- **Issue triage** — reproducing reported bugs, narrowing down causes,
  suggesting workarounds.
- **Feedback** — sharing how you use the editor, what is missing, what is
  confusing. Open an issue or discussion.
- **Translations** — adding or improving locale files in
  `packages/editor/src/main/i18n/`.

If you are looking for a starting point, browse issues labeled
[`good first issue`](https://github.com/BESSER-PEARL/BESSER-WEB-MODELING-EDITOR/labels/good%20first%20issue)
or [`help wanted`](https://github.com/BESSER-PEARL/BESSER-WEB-MODELING-EDITOR/labels/help%20wanted).

---

## 🧠 Asking Questions

Have a question?

- For usage or design questions,
  [open an issue](https://github.com/BESSER-PEARL/BESSER-WEB-MODELING-EDITOR/issues)
  or comment on an existing ticket.
- For private inquiries, email **info@besser-pearl.org**.

Please write **clear, concise** messages — the more detail you provide
(browser, OS, WME version, expected vs. actual behavior), the easier it is
to help.

---

## 🐞 Reporting Issues & Requesting Features

Found a bug or have a feature idea? We want to hear it.

1. **Search first.** Check the
   [issue list](https://github.com/BESSER-PEARL/BESSER-WEB-MODELING-EDITOR/issues)
   to avoid duplicates.
2. **One topic per issue.** Mixing concerns slows triage.
3. **Include reproduction details:**
   - Steps to reproduce
   - Expected vs. actual behavior
   - Browser, OS, and WME version (or commit hash if running locally)
   - Screenshots, screen recordings, or links to the model that triggers
     the issue
   - Console errors and network failures from DevTools
4. **Explain the impact.** Knowing *why* the change matters helps prioritize.

For feature requests, describe the use case, not just the implementation —
that opens room for the best design.

---

## 🍴 Setting Up Your Development Environment

### Prerequisites

- **Node.js 20+** and **npm** (CI runs on Node 20).
- **Git**.
- A running **BESSER backend** for full functionality (code generation,
  validation, deployment). The editor itself runs without it for pure
  diagramming work, but most "Generate / Validate / Deploy" flows need it.

### Fork, clone, and install

1. **Fork** this repository to your GitHub account.
2. **Clone** your fork:

   ```bash
   git clone https://github.com/<your-username>/BESSER-WEB-MODELING-EDITOR.git
   cd BESSER-WEB-MODELING-EDITOR
   ```

3. **Add the upstream remote** so you can keep your fork in sync:

   ```bash
   git remote add upstream https://github.com/BESSER-PEARL/BESSER-WEB-MODELING-EDITOR.git
   ```

4. **Install dependencies** from the monorepo root:

   ```bash
   npm install
   ```

   This installs all workspaces (`webapp2`, `editor`, `server`, legacy
   `webapp`) in one go.

### Run the dev server

```bash
npm run dev
```

The Vite dev server runs on http://localhost:8080 and expects the BESSER
backend at http://localhost:9000/besser_api in development mode (see
`packages/webapp2/src/main/constants/constant.ts`).

To run the BESSER backend locally, follow its
[setup instructions](https://github.com/BESSER-PEARL/BESSER#readme) and
start it with:

```bash
python besser/utilities/web_modeling_editor/backend/backend.py
```

### Useful commands

| Command                                         | Purpose                                            |
| ----------------------------------------------- | -------------------------------------------------- |
| `npm run dev`                                   | Start webapp2 with Vite + HMR                      |
| `npm run build`                                 | Build webapp2 + standalone server                  |
| `npm run build:webapp2`                         | Build webapp2 only                                 |
| `npm run build:local`                           | Build with localhost backend URLs                  |
| `npm run start:server`                          | Serve the built webapp via the Express server      |
| `npm run lint`                                  | ESLint across workspaces                           |
| `npm run prettier:check` / `prettier:write`     | Check / auto-format with Prettier                  |
| `npm run test`                                  | Vitest unit tests (webapp2)                        |
| `npm run test:e2e`                              | Playwright end-to-end tests                        |
| `npm run test:e2e:ui`                           | Playwright with interactive UI                     |

Per-workspace variants are available via `--workspace=<name>` (e.g.,
`npm run lint --workspace=editor`).

---

## 🗂️ Repository Tour

This is an **npm workspaces monorepo** with four packages:

| Package            | Status     | Purpose                                                        |
| ------------------ | ---------- | -------------------------------------------------------------- |
| `packages/webapp2` | **Active** | Main React SPA (Vite + React 18 + Tailwind + Radix UI)         |
| `packages/editor`  | **Active** | Core diagramming engine, published as `@besser/wme` on npm     |
| `packages/server`  | **Active** | Express server for standalone hosting (serves built `webapp2`) |
| `packages/webapp`  | **Legacy** | Old Webpack + Bootstrap app — reference only, do not modify    |

Almost all feature work happens in **`webapp2`** and **`editor`**.

| Path                                                | Purpose                                                                |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| `packages/webapp2/src/main/app/`                    | Shell, routing, Redux store                                            |
| `packages/webapp2/src/main/features/`               | Feature modules (editors, generation, deploy, github, import, …)       |
| `packages/webapp2/src/main/shared/`                 | Cross-feature code (API client, components, hooks, services)           |
| `packages/editor/src/main/apollon-editor.ts`        | Public API of the diagramming engine (`ApollonEditor` class)           |
| `packages/editor/src/main/packages/`                | Diagram-specific implementations (UML, BPMN, flowchart, …)             |
| `packages/editor/src/main/services/`                | Domain logic (CRUD, undo, layout, collaboration)                       |
| `packages/editor/src/main/i18n/`                    | Translations                                                           |
| `docs/`                                             | Sphinx docs published under the BESSER Read the Docs site              |

For deeper architecture notes, see
[`docs/source/contributing/codebase-guide.rst`](docs/source/contributing/codebase-guide.rst)
and the [WME architecture page](https://besser.readthedocs.io/projects/besser-web-modeling-editor/).

---

## 💻 Development Guidelines

### Code style

- **TypeScript strict mode** — keep types honest. `any` and `@ts-ignore`
  are warnings, not errors, but minimize their use.
- **Tailwind CSS** for styling in `webapp2`. No inline styles or CSS
  modules in webapp2. The editor package still uses styled-components
  (legacy).
- **Radix UI** for accessible primitives (Dialog, DropdownMenu, Tooltip,
  …). Prefer these over hand-rolled equivalents.
- **`_` prefix** for intentionally unused variables.
- ESLint warnings are acceptable but **errors must be fixed**.
- Prettier formatting is enforced — run `npm run prettier:write` before
  committing.

### Feature isolation

Features in `packages/webapp2/src/main/features/` **must not import from
each other**. If two features need the same logic, lift it into
`shared/`. Each feature owns its own hooks, components, and dialogs.

### Path aliases

Configured in both `tsconfig.json` and `vite.config.ts`:

- `@/` → `src/`
- `@besser/wme` → `../editor/src/main/index.ts` in local dev (npm in
  production)
- `shared` → `../shared/src/index.ts`
- `webapp/*` → `./*`

If you add a new alias, update **both** files.

### State management

- Project/diagram state lives in a single `workspaceSlice`. Use Redux
  Toolkit async thunks for mutations.
- Use `withoutNotify()` when writing to `ProjectStorageRepository` from a
  thunk to prevent infinite sync loops.
- Bump `editorRevision` only for **structural** changes (e.g., switching
  diagram types). Don't bump it for view-only toggles — it clears undo
  history.
- Use the typed hooks `useAppDispatch()` and `useAppSelector()` from
  `store/hooks.ts`.

### API communication

All backend calls go through `shared/api/api-client.ts`:

- Singleton `apiClient` with a 30 s timeout.
- Methods: `get()`, `post()`, `upload()` (FormData), `downloadBlob()`
  (binary).
- Custom `ApiError` class with HTTP status.

If you change a backend API contract, **update both the backend (Pydantic
models / endpoint) and `shared/api/`** in lock-step.

### Adding a new diagram element

Register the element in 4 files inside
`packages/editor/src/main/packages/`:

1. **`components.ts`** — `UMLElementType.YourElement` → React render
   component
2. **`uml-elements.ts`** — `UMLElementType.YourElement` → model class
3. **`compose-preview.ts`** — palette preview
4. **`popups.ts`** — property popup component

Then create the implementation in the appropriate diagram package
directory (e.g., `packages/uml-class-diagram/your-element/`) with:

- A model class extending `UMLElement` or `UMLRelationship`
- A React component
- An update function for property changes

### Adding a new diagram type

1. Add an entry to `diagram-type.ts` (`UMLDiagramType` object).
2. Create a package directory under
   `packages/editor/src/main/packages/`.
3. Register all elements in the four registry files.
4. Add editor support in `packages/webapp2/src/main/features/editors/`.
5. Add the diagram type to the BESSER backend's supported types if it
   needs generation/validation.

A full walk-through is in
[`docs/source/contributing/new-diagram-guide/`](docs/source/contributing/new-diagram-guide/).

---

## ✅ Testing Your Changes

### Lint & format

```bash
npm run lint
npm run prettier:check
```

### Unit tests (Vitest, jsdom)

```bash
npm run test --workspace=webapp2
```

While iterating, target a single test file with `npm run test -- <pattern>`.

### End-to-end tests (Playwright)

```bash
npm run test:e2e --workspace=webapp2
npm run test:e2e:ui --workspace=webapp2   # interactive
```

Run E2E from the `webapp2` workspace, **not** the monorepo root.

### Build

A passing build is part of the contract:

```bash
npm run build
```

Guidelines:

- **Add or update tests** alongside any behavior change.
- **Validate observable behavior**, not implementation details. Tests on
  rendered output age better than tests on internal structure.
- For UI changes, prefer Playwright over hand-clicking — write the
  scenario down once instead of demonstrating it manually for every
  reviewer.

---

## 🧾 Documentation Updates

User-facing docs live in `docs/source/` and are written in
reStructuredText (Sphinx). Keep them in sync with code: a new diagram
type, editor feature, or workflow should be reflected in the docs.

Build locally to check formatting:

```bash
cd docs
pip install -r requirements.txt
make html                   # Linux/macOS
# or:
sphinx-build -b html source build/html
```

Open `docs/build/html/index.html` to preview.

Common pages to update:

- `docs/source/editor/` — editor features and behavior
- `docs/source/user-guide/` — end-user workflows
- `docs/source/webapp/` — webapp shell, settings, project hub
- `docs/source/contributing/` — contributor-facing guides
- `docs/source/reference/` — API / schema references

Place images in `docs/source/images/` (or the relevant subfolder) and
reference them with relative paths.

---

## 🌿 Branching & Commits

### Branch naming

Create a topic branch off **`develop`** (the integration branch). Use a
prefix that matches the type of change:

| Prefix       | Use for                                          | Example                                |
| ------------ | ------------------------------------------------ | -------------------------------------- |
| `feature/`   | New features or capabilities                     | `feature/add-petri-net-diagram`        |
| `fix/`       | Bug fixes                                        | `fix/state-diagram-toolbar-mismatch`   |
| `docs/`      | Documentation-only changes                       | `docs/update-contributor-guide`        |
| `refactor/`  | Code restructuring without behavior changes      | `refactor/extract-component-registrar` |
| `test/`      | Test additions or improvements                   | `test/quantum-editor-e2e`              |
| `chore/`     | Tooling, CI, dependency bumps, repo maintenance  | `chore/bump-vite`                      |

Use **lowercase, hyphen-separated, descriptive** names. Avoid personal
prefixes (`arm/...`) and avoid umbrella branches that bundle unrelated
changes.

### Commit conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/).
Use one of these prefixes in your commit subject:

- `feat:` — a new feature
- `fix:` — a bug fix
- `docs:` — documentation-only changes
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `test:` — adding or fixing tests
- `chore:` — tooling, CI, dependency, or repo-maintenance changes

Keep subjects short, imperative, and lowercase, e.g.:

```
feat: add petri-net diagram type
fix: prevent infinite sync loop in storage thunk
docs: clarify branch naming in CONTRIBUTING
```

Group related work into logically scoped commits — reviewers should be
able to follow the reasoning commit by commit.

---

## 🔀 Creating Pull Requests

### Target branch

> **Open all pull requests against `develop`, not `main`.**
>
> The `main` branch tracks released versions of the editor. The `develop`
> branch is where features are integrated and validated before release.
> Maintainers periodically merge `develop` into `main` as part of the
> release process — contributors should not target `main` directly.

When opening the PR on GitHub, the **base branch** dropdown defaults to
`main`. **Change it to `develop`** before clicking *Create pull
request*:

```
base repository: BESSER-PEARL/BESSER-WEB-MODELING-EDITOR     base: develop   ←  change this!
head repository: <your-fork>/BESSER-WEB-MODELING-EDITOR      compare: feature/your-change
```

If you forget, no harm done — just edit the base branch on the existing
PR (GitHub allows changing it after creation). Maintainers will also
flag it.

### Step-by-step

1. **Sync your fork and branch off `develop`:**

   ```bash
   git checkout develop
   git pull upstream develop
   git checkout -b feature/your-change
   ```

2. **Commit your work** using the
   [Conventional Commits](#commit-conventions) prefixes. Make focused
   commits.

3. **Run quality checks locally** before pushing:

   ```bash
   npm run lint
   npm run prettier:check
   npm run test --workspace=webapp2
   npm run build
   ```

4. **Push your branch:**

   ```bash
   git push -u origin feature/your-change
   ```

5. **Open the PR on GitHub** with `develop` as the base branch (see
   above). If the work is in progress and you want early feedback, open
   it as a **draft PR** — maintainers will review when you mark it ready.

6. **Rebase or merge `develop`** into your branch before requesting
   final review:

   ```bash
   git fetch upstream
   git rebase upstream/develop
   git push --force-with-lease
   ```

7. **Respond to review feedback.** Review is a collaborative
   conversation, not a gate.

### Writing a good PR description

A great PR description answers four questions: **What changed? Why? How
was it tested? What should reviewers pay attention to?** Use this
template (the PR template in this repo follows the same structure):

```markdown
## What

A 1–3 sentence summary of the change. Stay concrete — name the files,
features, components, or diagram types you touched.

## Why

The motivation. Link the issue (`Closes #123`), or describe the bug,
limitation, or use case driving the change. Reviewers should not have
to guess the intent.

## How

A brief explanation of the approach, *especially* for non-obvious design
choices. Mention alternatives you considered and why you discarded them.
Skip this section for trivial fixes.

## Testing

- Unit tests added/updated: `packages/webapp2/src/.../foo.test.ts`
- E2E tests added/updated: `packages/webapp2/tests/e2e/...`
- Manual checks: e.g., "loaded the editor, created a class diagram with
  inheritance, exported, re-imported — round-trip preserved"
- Edge cases considered: …

## Screenshots / Recordings

(For UI changes, include before/after screenshots or short recordings.)

## Follow-ups / Known limitations

Anything intentionally out of scope for this PR, or known gaps to address
later. Linking a follow-up issue is even better.

## Checklist

- [ ] Targeted `develop` (not `main`)
- [ ] `npm run lint` passes
- [ ] `npm run prettier:check` passes
- [ ] `npm run test --workspace=webapp2` passes
- [ ] `npm run build` succeeds
- [ ] Docs updated (`docs/source/...`) if user-facing behavior changed
- [ ] Backend submodule pointer updated in BESSER (if cross-repo change)
- [ ] No stray `console.log` or debug code
```

#### Tips

- **Title matters.** Use a Conventional Commits-style title that mirrors
  your main commit, e.g. `feat: add petri-net diagram type`. Reviewers
  scan PR lists by title.
- **Be specific, not generic.** "Fix bug" is not a PR description. "Fix
  state-diagram toolbar showing object-diagram elements after switching
  diagram types" is.
- **Show, don't tell.** UI work without screenshots is much harder to
  review.
- **Call out anything risky.** Schema/storage migrations, breaking API
  changes, dependency bumps, performance trade-offs — flag them
  explicitly.
- **Keep it focused.** One PR = one logical change. If you find yourself
  writing "this PR also …", split it.

### Review & merging

- All PRs must pass automated checks: ESLint (webapp2 + server), Prettier,
  the production build, and Vitest unit tests.
- At least one maintainer review is required, per the
  [governance rules](GOVERNANCE.md).
- Maintainers choose the merge strategy (squash, rebase, or merge commit)
  based on the change.

---

## 🔗 Cross-Repo Changes (BESSER Backend)

This repo is vendored into the BESSER backend as a git submodule at
`besser/utilities/web_modeling_editor/frontend`.

When a change touches **both** repositories (e.g., a new diagram type, an
API contract change):

1. Implement and commit the **frontend** change here, targeting
   `develop`.
2. Implement and commit the **backend** change in
   [BESSER](https://github.com/BESSER-PEARL/BESSER), targeting
   `development`.
3. Update the submodule pointer in the BESSER repo to the new WME commit:

   ```bash
   # in the BESSER repo
   cd besser/utilities/web_modeling_editor/frontend
   git pull origin develop
   cd ../../../..
   git add besser/utilities/web_modeling_editor/frontend
   git commit -m "chore: bump frontend submodule"
   ```

4. **Link the two PRs** in their descriptions and note the intended
   **merge order**.

When you see `M besser/utilities/web_modeling_editor/frontend` in the
parent repo's `git status`, the submodule pointer has moved.

---

## 🧭 Governance

All contributions are reviewed by project maintainers following the rules
in [GOVERNANCE.md](GOVERNANCE.md). This ensures fair, transparent
decision-making. If a discussion stalls, maintainers will help unblock
it.

---

## 💖 Thank You!

Your contributions — big or small — make BESSER better. Thank you for
your time, energy, and passion for open source.

If anything in this guide is unclear or out of date, that itself is a
great first contribution: open a `docs/` PR and propose an improvement.
