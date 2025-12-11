CLI Reference
=============

Root scripts
------------

``package.json`` at the workspace root defines scripts that orchestrate the
packages via npm workspaces.

===========  ============================================================
Script       Description
===========  ============================================================
``npm run dev``             Runs the webapp dev server and Express server concurrently.
``npm run start:webapp``    Alias for ``npm run start --workspace=webapp``.
``npm run start:server``    Launches the Express server with ``ts-node-dev``.
``npm run build``           Builds shared DTOs, then produces production bundles for the webapp and server.
``npm run build:local``     Similar to ``build`` but bundles the webapp with a local ``DEPLOYMENT_URL``.
``npm run build:webapp``    Runs the webapp's production webpack build.
``npm run build:webapp:local``  Builds the webapp with ``DEPLOYMENT_URL=http://localhost:8080``.
``npm run build:server``    Bundles the Express server via webpack.
``npm run build:shared``    Compiles the shared DTO package.
``npm run lint``            Runs ESLint for the webapp and server packages.
``npm run lint:webapp``     Runs ESLint in the webapp workspace.
``npm run lint:server``     Runs ESLint in the server workspace.
``npm run prettier:check``  Validates formatting across all packages.
``npm run prettier:write``  Applies formatting fixes.
``npm run update``          Uses ``npm-check-updates`` to refresh dependency versions interactively.
===========  ============================================================

Package-specific scripts
------------------------

Editor (``packages/editor``)
   * ``npm run lint`` – ESLint for the editor package.
   * ``npm run lint:ts`` / ``lint:css`` – TypeScript and styled-components linting.
   * ``npm run prettier:*`` – Formatting helpers scoped to the editor source.

Webapp (``packages/webapp``)
   * ``npm run start`` – ``webpack-dev-server`` on port 8080.
   * ``npm run build`` – Production bundle under ``build/webapp``.
   * ``npm run build:local`` – Production bundle with local deployment URL.
   * ``npm run lint`` – ESLint across TypeScript sources.

Server (``packages/server``)
   * ``npm run start`` – ``ts-node-dev`` hot-reloading server on port 8080.
   * ``npm run build`` – Webpack bundle of the Express server.
   * ``npm run lint`` – ESLint across TypeScript sources.

Shared DTOs (``packages/shared``)
   * ``npm run build`` – Compiles TypeScript definitions to ``dist/``.

Documentation (``docs``)
   * ``make html`` – Builds Sphinx docs into ``docs/build/html``.
   * ``make livehtml`` – Optional live-reload server (requires ``sphinx-autobuild``).
