Development Workflow
====================

This page describes the day-to-day workflow for contributing to the BESSER
Web Modeling Editor: dev servers, automated checks, branching, and pull
requests. For a higher-level overview of the codebase, see
:doc:`codebase-guide`. The root-level ``CONTRIBUTING.md`` is the
authoritative summary; this page expands on the parts that benefit from
extra detail.

.. contents:: On this page
   :local:
   :depth: 2

1. Install dependencies
-----------------------

.. code-block:: bash

   npm install

Use the workspace root. npm installs all packages declared in
``workspaces``.

2. Start the appropriate dev server
-----------------------------------

* ``npm run dev`` – Vite development server for ``webapp2`` with HMR.
* ``npm run start:server`` – Express server serving compiled assets.

The Vite dev server runs on http://localhost:8080 and expects the BESSER
backend at http://localhost:9000/besser_api in development mode.

3. Run automated checks
-----------------------

.. list-table::
   :header-rows: 1
   :widths: 30 50 20

   * - Command
     - Description
     - Location
   * - ``npm run lint``
     - Runs ESLint for webapp + server
     - root workspace
   * - ``npm run lint --workspace=editor``
     - Lints the editor package
     - editor
   * - ``npm run lint --workspace=webapp2``
     - Lints the React app
     - webapp2
   * - ``npm run lint --workspace=server``
     - Lints the Express server
     - server
   * - ``npm run test --workspace=webapp2``
     - Runs unit tests with Vitest
     - webapp2
   * - ``npm run test:e2e --workspace=webapp2``
     - Runs end-to-end tests with Playwright
     - webapp2
   * - ``npm run prettier:check``
     - Verifies formatting
     - root workspace
   * - ``npm run build:webapp2``
     - Production bundle for UI
     - webapp2
   * - ``npm run build:server``
     - Bundles Express server
     - server

When contributing to the editor, run package-specific checks:

.. code-block:: bash

   npm run lint --workspace=editor
   npm run prettier:check --workspace=editor   # optional, run from package root

4. Update documentation
-----------------------

Use Sphinx to preview docs locally:

.. code-block:: bash

   cd docs
   pip install -r requirements.txt
   make html

Open ``docs/build/html/index.html`` in a browser and ensure the sections
you modified render correctly. Commit documentation updates alongside the
code changes they describe.

5. Branch off ``develop`` with a meaningful prefix
--------------------------------------------------

Create a topic branch off **``develop``** (the integration branch) for
each logical change. **Do not branch from or target** ``main``
**directly** — ``main`` tracks released versions, while ``develop`` is
where features are integrated before a release.

Use a prefix that matches the type of change, mirroring our Conventional
Commits style:

.. list-table::
   :header-rows: 1
   :widths: 15 50 35

   * - Prefix
     - Use for
     - Example
   * - ``feature/``
     - New features or capabilities
     - ``feature/add-petri-net-diagram``
   * - ``fix/``
     - Bug fixes
     - ``fix/state-diagram-toolbar-mismatch``
   * - ``docs/``
     - Documentation-only changes
     - ``docs/update-contributor-guide``
   * - ``refactor/``
     - Code restructuring without behavior changes
     - ``refactor/extract-component-registrar``
   * - ``test/``
     - Test additions or improvements
     - ``test/quantum-editor-e2e``
   * - ``chore/``
     - Tooling, CI, dependency bumps, repo maintenance
     - ``chore/bump-vite``

Use **lowercase, hyphen-separated, descriptive** names. Avoid personal
prefixes (``arm/...``) and avoid umbrella branches that bundle unrelated
changes.

Sync your fork before branching::

   git checkout develop
   git pull upstream develop
   git checkout -b feature/your-change

6. Commit using Conventional Commits
------------------------------------

We follow `Conventional Commits <https://www.conventionalcommits.org/>`_.
Use one of these prefixes in your commit subject:

* ``feat:`` — a new feature
* ``fix:`` — a bug fix
* ``docs:`` — documentation-only changes
* ``refactor:`` — code change that neither fixes a bug nor adds a feature
* ``test:`` — adding or fixing tests
* ``chore:`` — tooling, CI, dependency, or repo-maintenance changes

Keep subjects short, imperative, and lowercase, e.g.::

   feat: add petri-net diagram type
   fix: prevent infinite sync loop in storage thunk
   docs: clarify branch naming in CONTRIBUTING

Group related work into logically scoped commits — reviewers should be
able to follow the reasoning commit by commit.

7. Prepare your pull request
----------------------------

Before opening a PR, run through this checklist:

.. code-block:: text

   [ ] npm run lint passes (no ESLint errors)
   [ ] npm run prettier:check passes (formatting clean)
   [ ] npm run test --workspace=webapp2 passes (unit tests green)
   [ ] npm run build succeeds (production bundles compile)
   [ ] Documentation updated (if you changed user-facing behavior)
   [ ] No stray debug logs or console.log statements

8. Open the PR against ``develop``
----------------------------------

.. important::

   **Open all pull requests against** ``develop``\ **, not** ``main``.

   The ``main`` branch tracks released versions of the editor. The
   ``develop`` branch is where features are integrated and validated
   before release. Maintainers periodically merge ``develop`` into
   ``main`` as part of the release process — contributors should not
   target ``main`` directly.

When opening the PR on GitHub, the **base branch** dropdown defaults to
``main``. **Change it to** ``develop`` before clicking *Create pull
request*::

   base repository: BESSER-PEARL/BESSER-WEB-MODELING-EDITOR     base: develop   ←  change this!
   head repository: <your-fork>/BESSER-WEB-MODELING-EDITOR      compare: feature/your-change

If you forget, no harm done — just edit the base branch on the existing
PR (GitHub allows changing it after creation). Maintainers will also flag
it.

If the work is in progress and you want early feedback, open a **draft
PR** — maintainers will review when you mark it ready.

Rebase ``develop`` into your branch before requesting final review:

.. code-block:: bash

   git fetch upstream
   git rebase upstream/develop
   git push --force-with-lease

9. Writing a good PR description
--------------------------------

A great PR description answers four questions: **What changed? Why? How
was it tested? What should reviewers pay attention to?** Use this
template:

.. code-block:: markdown

   ## What

   A 1–3 sentence summary of the change. Stay concrete — name the files,
   features, components, or diagram types you touched.

   ## Why

   The motivation. Link the issue (`Closes #123`), or describe the bug,
   limitation, or use case driving the change. Reviewers should not have
   to guess the intent.

   ## How

   A brief explanation of the approach, *especially* for non-obvious
   design choices. Mention alternatives you considered and why you
   discarded them. Skip this section for trivial fixes.

   ## Testing

   - Unit tests added/updated: `packages/webapp2/src/.../foo.test.ts`
   - E2E tests added/updated: `packages/webapp2/tests/e2e/...`
   - Manual checks: e.g., "loaded the editor, created a class diagram
     with inheritance, exported, re-imported — round-trip preserved"
   - Edge cases considered: …

   ## Screenshots / Recordings

   (For UI changes, include before/after screenshots or short
   recordings.)

   ## Follow-ups / Known limitations

   Anything intentionally out of scope for this PR, or known gaps to
   address later. Linking a follow-up issue is even better.

   ## Checklist

   - [ ] Targeted `develop` (not `main`)
   - [ ] `npm run lint` passes
   - [ ] `npm run prettier:check` passes
   - [ ] `npm run test --workspace=webapp2` passes
   - [ ] `npm run build` succeeds
   - [ ] Docs updated (`docs/source/...`) if user-facing behavior changed
   - [ ] Backend submodule pointer updated in BESSER (if cross-repo
         change)
   - [ ] No stray `console.log` or debug code

Tips
~~~~

* **Title matters.** Use a Conventional Commits-style title that mirrors
  your main commit, e.g. ``feat: add petri-net diagram type``. Reviewers
  scan PR lists by title.
* **Be specific, not generic.** "Fix bug" is not a PR description. "Fix
  state-diagram toolbar showing object-diagram elements after switching
  diagram types" is.
* **Show, don't tell.** UI work without screenshots is much harder to
  review.
* **Call out anything risky.** Schema/storage migrations, breaking API
  changes, dependency bumps, performance trade-offs — flag them
  explicitly.
* **Keep it focused.** One PR = one logical change. If you find yourself
  writing "this PR also …", split it.

10. What happens after you push
-------------------------------

CI will automatically run:

* ESLint linting for webapp2 and server
* Prettier formatting check
* Production build (``npm run build``)
* Unit tests (Vitest) on webapp2

If CI fails, check the logs, fix the issue, and push again. Maintainers
will review once CI is green and the PR is marked ready.

11. Cross-repo changes (BESSER backend)
---------------------------------------

If your change touches both this repo and the
`BESSER backend <https://github.com/BESSER-PEARL/BESSER>`_:

1. Implement and commit the **frontend** change here, targeting
   ``develop``.
2. Implement and commit the **backend** change in the BESSER repo,
   targeting ``development``.
3. Update the submodule pointer in the BESSER repo to the new WME
   commit:

   .. code-block:: bash

      # in the BESSER repo
      cd besser/utilities/web_modeling_editor/frontend
      git pull origin develop
      cd ../../../..
      git add besser/utilities/web_modeling_editor/frontend
      git commit -m "chore: bump frontend submodule"

4. **Link the two PRs** in their descriptions and note the intended
   **merge order**.

For the full cross-repo checklist, see :doc:`new-diagram-guide/index`.
