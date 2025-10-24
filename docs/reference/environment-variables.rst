Environment variables
=====================

Reference for environment variables used by the workspace.

Core variables
--------------

``APPLICATION_SERVER_VERSION``
    Toggle collaboration features in the webapp.
``DEPLOYMENT_URL``
    Public base URL for API calls, share links, and WebSocket connections.
``BACKEND_URL``
    Optional endpoint for auxiliary backends when running in development mode.
``SENTRY_DSN``
    Enables Sentry telemetry on the server and optionally in the client.
``POSTHOG_HOST`` / ``POSTHOG_KEY``
    Configure PostHog analytics.
``UML_BOT_WS_URL``
    Set the WebSocket endpoint for the UML Bot widget.

Storage
-------

``APOLLON_REDIS_URL``
    Redis connection string. When set, enables Redis storage.
``APOLLON_REDIS_DIAGRAM_TTL``
    TTL for diagrams stored in Redis (parsed via ``ms``).
``APOLLON_REDIS_MIGRATE_FROM_FILE``
    Enable one-time migration from filesystem to Redis storage.

Build-time
----------

* Webpack injects these variables at compile time using ``DefinePlugin``. Update
  values before running ``npm run build``.

Server runtime
--------------

* Ensure environment variables are set for the process manager (systemd,
  Docker, Kubernetes) before launching ``server.js``.

Next steps
----------

Consult :doc:`file-structure` for directory layout.
