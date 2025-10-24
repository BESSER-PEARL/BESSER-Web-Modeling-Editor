Quickstart
==========

This walkthrough demonstrates how to run the editor locally, first as a
front-end-only experience and then together with the Node.js collaboration
server. Each scenario uses npm scripts from the workspace root.

Front-end only
--------------

This mode is ideal for evaluating the editor UI, exporting diagrams, or hosting
the application as static files.

#. Install dependencies using ``npm install``.
#. Build the shared DTO package and the webapp bundle::

     npm run build:shared
     npm run build:webapp

#. The compiled assets live under :file:`build/webapp`. Serve the
   :file:`index.html` with any static web server (``python3 -m http.server`` or
   ``npx http-server``).
#. Open ``http://localhost:8000`` (or the port you chose) and start modelling.

Combined webapp and server
--------------------------

Use this workflow to unlock sharing, collaboration, and version history.

#. Ensure the prerequisites from :doc:`installation` are satisfied, including
   native build dependencies for ``node-canvas`` if you need export pipelines.
#. Configure environment variables for the build. The most important ones are::

     export APPLICATION_SERVER_VERSION=1
     export DEPLOYMENT_URL=http://localhost:8080

#. Build both the client and server::

     npm run build

#. Create a directory for persisted diagrams when using the filesystem storage::

     mkdir -p diagrams

#. Start the server::

     npm run start:server

   The server listens on port 8080 by default (see :file:`packages/server/src/main/server.ts`).
#. In another terminal start the webapp dev server with hot reloading::

     npm run start:webapp

   The webpack dev server proxies API calls to the Node.js backend and serves the
   React application on ``http://localhost:8888``.
#. Navigate to ``http://localhost:8888`` to confirm the editor loads and the
   share menu offers collaboration modes.

All-in-one development loop
---------------------------

To run both servers concurrently during development, use the dedicated script::

  npm run dev

This command spawns the webpack development server (port 8888) and the Express
server (port 8080). Changes to the TypeScript source trigger live reloads.

Smoke testing the build
-----------------------

After building, run the following checks to verify the bundle integrity::

  npm run lint
  npm run prettier:check

The :doc:`development/testing <../development/testing>` guide explains the full
test matrix, including unit tests in package-specific directories.
