Environment Variables
=====================

Set environment variables before running the build or start scripts. The webapp
loads variables from ``packages/webapp/webpack/.env`` via ``dotenv-webpack`` and
respects system environment variables. The server reads directly from
``process.env``.

Web application
---------------

``APPLICATION_SERVER_VERSION``
   Boolean flag exposed to the UI. When truthy the application surfaces server
   backed features such as diagram sharing and collaboration. Defaults to
   ``true`` in ``webpack.common.js`` if not provided.

``DEPLOYMENT_URL``
   Base URL used to derive API endpoints (``BASE_URL``) and WebSocket URLs.
   Required when hosting behind a reverse proxy. Defaults to ``undefined`` in
   development which makes the webapp rely on relative URLs.

``BACKEND_URL``
   HTTP endpoint exposed by the BESSER backend that serves code generation.
   Defaults to ``http://localhost:9000/besser_api`` when ``NODE_ENV`` is
   ``development``; otherwise the UI expects this variable to be set explicitly.

``SENTRY_DSN``
   Optional DSN for Sentry browser monitoring.

``POSTHOG_HOST`` / ``POSTHOG_KEY``
   Optional analytics configuration for PostHog. Leave unset to disable
   tracking.

``UML_BOT_WS_URL``
   WebSocket endpoint used by the UML agent widget. Defaults to
   ``ws://localhost:8765`` in development or ``<WS_PROTOCOL>://<DEPLOYMENT_HOST>``
   otherwise.

Server
------

``DEPLOYMENT_URL``
   Used to rewrite absolute URLs inside the compiled webapp and to give Sentry a
   meaningful environment tag.

``SENTRY_DSN``
   Optional DSN for server-side error reporting.

``APOLLON_REDIS_URL``
   When set, enables Redis-based storage for shared diagrams instead of the
   filesystem. Should be a standard Redis connection string
   (``redis://user:pass@host:port``).

``APOLLON_REDIS_DIAGRAM_TTL``
   Optional TTL (parsed with the ``ms`` package, e.g. ``30d``) applied to stored
   diagrams when using Redis.

``APOLLON_REDIS_MIGRATE_FROM_FILE``
   If defined, migrates diagrams from file storage into Redis during start-up.
   Set to any truthy value to enable the migration.

Common
------

``NODE_ENV``
   Drives webpack's development vs production configuration and influences the
   default ``BACKEND_URL`` and WebSocket URL selection.

Set variables inline when running scripts, e.g.:

.. code-block:: bash

   DEPLOYMENT_URL=https://editor.example.com \
   BACKEND_URL=https://api.example.com/besser_api \
   npm run build

Or create ``packages/webapp/webpack/.env`` for development:

.. code-block:: text

   DEPLOYMENT_URL=http://localhost:8080
   BACKEND_URL=http://localhost:9000/besser_api
