Development Workflow
====================

1. Install dependencies
-----------------------

.. code-block:: bash

   npm install

Use the workspace root. npm installs all packages declared in ``workspaces``.

2. Start the appropriate dev server
-----------------------------------

* ``npm run dev`` – Vite development server for webapp2 with HMR.
* ``npm run start:server`` – Express API serving compiled assets.

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

Open ``docs/build/html/index.html`` in a browser and ensure the sections you
modified render correctly. Commit documentation updates alongside the code
changes they describe.

5. Prepare your pull request
----------------------------

Before opening a PR, run through this checklist:

.. code-block:: text

   [ ] npm run lint passes (no ESLint errors)
   [ ] npm run prettier:check passes (formatting clean)
   [ ] npm run test --workspace=webapp2 passes (unit tests green)
   [ ] npm run build succeeds (production bundles compile)
   [ ] Documentation updated (if you changed user-facing behavior)
   [ ] No stray debug logs or console.log statements

In your PR description, include:

* **What** changed and **why**.
* **How to test** (steps a reviewer can follow).
* **Screenshots** if the change affects the UI.
* **Follow-up work** if any tasks remain.

6. What happens after you push
-------------------------------

CI will automatically run:

* ESLint linting for webapp2 and server
* Prettier formatting check
* Production build (``npm run build``)
* Unit tests (Vitest) on webapp2

If CI fails, check the logs, fix the issue, and push again. Maintainers will
review once CI is green.

