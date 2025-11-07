Getting Started
===============

Prerequisites
-------------

* Node.js **22.10.0** or newer (the workspace relies on the built-in `crypto`
  Web APIs and `ts-node-dev` shipping with Node 22).
* npm 10 (bundled with current Node releases). Yarn/pnpm are not officially
  supported.
* Git for cloning the repository.

Clone and install
-----------------

.. code-block:: bash

   git clone https://github.com/BESSER-PEARL/BESSER-Web-Modeling-Editor.git
   cd BESSER-Web-Modeling-Editor/utilities/web_modeling_editor/frontend
   npm install

The project uses npm workspaces. `npm install` resolves dependencies for the
root package and cascades into the `packages/*` folders.

Run the web application locally
-------------------------------

There are two ways to start the UI depending on whether you need the Express
server alongside the React dev server.

React development server only
   .. code-block:: bash

      npm run start --workspace=webapp

   This starts `webpack-dev-server` on http://localhost:8080 and hot-reloads
   React components. API requests targeting ``/api`` will fail unless you run
   the Express server separately.

Integrated server + static assets
   .. code-block:: bash

      npm run build:webapp:local
      npm run start:server

   The build step outputs static assets under ``build/webapp`` with
   ``DEPLOYMENT_URL`` defaulting to ``http://localhost:8080``. The Express
   server serves those assets and exposes the diagram REST endpoints on the
   same port.

Full stack convenience script
   .. code-block:: bash

      npm run dev

   This script invokes ``start:webapp`` and ``start:server`` concurrently. If
   you reuse the default ports ensure only one renderer handles 8080 at a time.
   In practice, run the server only after the dev server has finished building
   or adjust the ``devServer.port`` in ``packages/webapp/webpack/webpack.dev.js``.

Recommended verification
------------------------

1. Open http://localhost:8080 and create a new Class Diagram.
2. Drag an element onto the canvas and confirm autosave updates the local
   project (check the browser's localStorage entries prefixed with ``besser_``).
3. Export the diagram as SVG from the application bar; the generated file should
   contain the expected graphics.

If the UI fails to load, inspect the browser console and the terminal output
from ``start:webapp`` and ``start:server``. Many runtime issues stem from
missing environment variables—see :doc:`../reference/environment`.
