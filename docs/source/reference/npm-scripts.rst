npm scripts
===========

The root :file:`package.json` defines scripts for common tasks.

Development
-----------

``npm run dev``
    Start both webapp and server concurrently.
``npm run start:webapp``
    Launch the webpack development server on port 8888.
``npm run start:server``
    Start the Express server on port 8080.

Build
-----

``npm run build``
    Build shared DTOs, webapp, and server for production.
``npm run build:local``
    Build assets tailored for local testing.
``npm run build:webapp``
    Build only the webapp bundle.
``npm run build:server``
    Build only the server bundle.
``npm run build:shared``
    Compile shared DTOs.

Quality
-------

``npm run lint``
    Run ESLint/Stylelint across packages.
``npm run prettier:check``
    Verify formatting.
``npm run prettier:write``
    Auto-format supported files.

Maintenance
-----------

``npm run update``
    Use ``npm-check-updates`` to bump dependencies interactively.
``npm run lint:webapp``
    Lint only the webapp package.
``npm run lint:server``
    Lint only the server package.
``npm run build:webapp:local``
    Produce a webapp build optimised for local server integration.

Workspaces
----------

Scripts can be executed per package::

  npm run <script> --workspace=webapp
  npm run <script> --workspace=server

Next steps
----------

Refer to :doc:`environment-variables` for runtime configuration options.
