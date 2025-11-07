Development Workflow
====================

1. Install dependencies
-----------------------

.. code-block:: bash

   npm install

Use the workspace root. npm installs all packages declared in ``workspaces``.

2. Start the appropriate dev server
-----------------------------------

* ``npm run start --workspace=webapp`` – React development server with HMR.
* ``npm run start:server`` – Express API serving compiled assets.
* ``npm run dev`` – convenience script that launches both (watch out for port
  conflicts; adjust ``webpack.dev.js`` if needed).

3. Run automated checks
-----------------------

===========  ===============================================  ===============================================
Command      Description                                      Location
===========  ===============================================  ===============================================
``npm run lint``          Runs ESLint for webapp + server      root workspace
``npm run lint --workspace=editor``     Lints the editor package             editor
``npm run lint --workspace=webapp``     Lints the React app                  webapp
``npm run lint --workspace=server``     Lints the Express server             server
``npm run prettier:check``              Verifies formatting                  root workspace
``npm run build:webapp``                Production bundle for UI             webapp
``npm run build:server``                Bundles Express server               server
``npm run build:shared``                Builds shared DTOs                   shared
===========  ===============================================  ===============================================

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

* Ensure ``npm run build`` succeeds; it composes the shared, webapp, and server
  bundles.
* Run the relevant unit or integration tests if you added them.
* Clean up stray debug logs and keep diffs focused.
* Summarise the change, the motivation, and any follow-up work in your PR
  description.

Following the checklist keeps reviews fast and helps maintainers merge your work
without surprises.
