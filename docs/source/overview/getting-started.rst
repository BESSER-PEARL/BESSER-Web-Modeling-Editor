Run the editor from source
==========================

To use the hosted editor, start with :doc:`../tutorials/first-project`.
For a Docker deployment, follow :doc:`../user-guide/deploy_locally`.
This page is for running and changing the frontend locally.

Before you start
----------------

Install Git, Node.js 20 or newer, and npm 10. Use the supported versions
specified in the repository when upgrading the frontend toolchain.

Clone the integration branch and install workspace dependencies:

.. code-block:: console

   git clone --branch develop https://github.com/BESSER-PEARL/BESSER-Web-Modeling-Editor.git
   cd BESSER-Web-Modeling-Editor
   npm install

Configure and start
-------------------

Create ``packages/webapp/.env`` with the URLs of your local services:

.. code-block:: text

   BACKEND_URL=http://localhost:9000/besser_api
   UML_BOT_WS_URL=ws://localhost:8765

See :doc:`../reference/environment` for all options. Then start Vite:

.. code-block:: console

   npm run dev

Open ``http://localhost:8080``. If that port is busy or reserved, choose
another port:

.. code-block:: console

   npm run dev --workspace=webapp -- --port 5173

You can draw and export JSON locally. Code generation, validation, and
B-UML conversion need the BESSER backend. AI modeling needs the separate
modeling-agent service. :doc:`../user-guide/deploy_locally` covers the services.

Check the workspace
-------------------

Create a project, drag a class onto the canvas, rename it, and export a
project copy. Then run:

.. code-block:: console

   npm run lint
   npm run test --workspace=webapp
   npm run build:webapp:local

For a static local preview, ``npm run start:server`` serves the build from
``build/webapp`` on port 8080. Restart or rebuild after environment changes:
frontend URLs are embedded at build time.

Continue with :doc:`../contributing/development-workflow` for the contributor
workflow or :doc:`../user-guide/troubleshooting` when a service does not connect.
