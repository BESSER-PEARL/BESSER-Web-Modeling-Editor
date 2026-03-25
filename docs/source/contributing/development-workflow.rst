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

* Ensure ``npm run build`` succeeds; it composes the webapp and server
  bundles.
* Run the relevant unit or integration tests if you added them.
* Clean up stray debug logs and keep diffs focused.
* Summarise the change, the motivation, and any follow-up work in your PR
  description.

Following the checklist keeps reviews fast and helps maintainers merge your work
without surprises.

