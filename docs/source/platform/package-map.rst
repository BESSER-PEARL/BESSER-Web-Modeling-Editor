Package map
===========

The workspace is divided into four primary packages. Understanding their
responsibilities helps contributors locate source files quickly.

``packages/editor``
-------------------

* Houses reusable components, domain models, and services that augment the
  ``@besser/wme`` engine.
* Provides TypeScript source under :file:`src/` with build targets defined in
  :file:`tsconfig.json` and :file:`tsconfig.es5.json` for compatibility bundles.
* Publishes artefacts consumed by both the standalone webapp and server via npm
  workspaces.

``packages/webapp``
-------------------

* Contains the React SPA entrypoints in :file:`src/main/`.
* ``components/`` – UI building blocks such as the application bar, share modal,
  sidebar layouts, and integration widgets.
* ``services/`` – wrappers around APIs, local storage, and analytics providers.
* ``store/`` and ``hooks/`` – state management utilities.
* ``templates/`` – curated diagram starters and their metadata.
* ``webpack/`` – shared, production, and development Webpack configurations.

``packages/server``
-------------------

* ``src/main/server.ts`` – Express bootstrap that serves the webapp bundle and
  registers routes.
* ``services/`` – collaboration, conversion, diagram persistence, and storage
  adapters. Includes Redis and filesystem implementations plus migration support.
* ``resources/`` – handlebars templates and static assets served alongside the
  API.
* ``routes.ts`` – centralises REST endpoint registration.
* ``utils.ts`` – helper functions such as ``randomString`` and token utilities.

``packages/shared``
-------------------

* ``src/main/`` – shared DTOs, validation schemas, and type definitions used by
  the other packages.
* ``package.json`` – exposes a build script to compile TypeScript into CommonJS
  modules consumed by the server and webapp.

Build artefacts
---------------

* Each package outputs compiled code into :file:`build/` when ``npm run build``
  is executed from the workspace root.
* The root ``node_modules`` contains hoisted dependencies while package-specific
  dependencies reside under ``packages/*/node_modules``.

Next steps
----------

Review :doc:`data-flow` to understand how information moves between these
packages during runtime.
