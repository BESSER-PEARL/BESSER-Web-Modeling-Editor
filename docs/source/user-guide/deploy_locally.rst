Run the editor locally
======================

**Goal:** start the editor and its Python backend with Docker Compose.
Use Docker with Compose v2 and Git. The hosted editor does not need this setup.

Clone and configure
-------------------

.. code-block:: console

   git clone --recurse-submodules https://github.com/BESSER-PEARL/BESSER.git
   cd BESSER

Copy the root ``.env.example`` to ``.env`` and set values for your local
deployment. The frontend service also reads
``besser/utilities/web_modeling_editor/frontend/packages/webapp/webpack/.env``;
the legacy compose definition expects this file even though its directory is
not shipped. Create the directory and file with the local URLs below.

.. code-block:: text

   DEPLOYMENT_URL=http://localhost:8080
   BACKEND_URL=http://localhost:9000/besser_api
   UML_BOT_WS_URL=ws://localhost:8765

Frontend URLs are baked into the JavaScript at build time. The compose
``env_file`` alone cannot change them. Supply these values in
``besser/utilities/web_modeling_editor/frontend/packages/webapp/.env`` before
building, or pass them as Docker build arguments. See
:doc:`../reference/environment` for the complete variable reference.

Build and start
---------------

.. code-block:: console

   docker compose up --build -d
   docker compose ps

Open ``http://localhost:8080``. Check
``http://localhost:9000/besser_api/`` for a backend response, then create a
class diagram and try **Quality Check**.

The root compose file starts the frontend, backend, and agent simulator.
Its modeling-agent service is commented out: the conversational assistant
needs that service started separately. Follow the
`modeling-agent setup guide <https://github.com/BESSER-PEARL/modeling-agent/blob/develop/docs/source/getting_started.rst>`_
to configure it before using AI modeling.

Check logs and stop
-------------------

.. code-block:: console

   docker compose logs --tail=100 besser-wme-backend
   docker compose logs --tail=100 besser-wme-frontend
   docker compose down

For source development, use :doc:`../overview/getting-started`. For a hosted
v8 deployment with the separate generation worker, use the
`production runbook <https://besser.readthedocs.io/en/latest/spec_driven_agent/production_deployment.html>`_.
