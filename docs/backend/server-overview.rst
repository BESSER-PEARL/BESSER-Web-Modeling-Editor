Server overview
===============

The collaboration server (:file:`packages/server/src/main/server.ts`) is an
Express.js application compiled with Webpack. It serves the static webapp bundle
and registers APIs for diagram persistence and export.

Key responsibilities
--------------------

* Serve the built webapp assets from ``build/webapp``.
* Rewrite static asset URLs during build to respect ``DEPLOYMENT_URL``.
* Register REST endpoints and WebSocket handlers for collaboration features.
* Initialise telemetry (Sentry) when ``SENTRY_DSN`` is configured.

Bootstrap sequence
------------------

#. Load ``DEPLOYMENT_URL`` and other environment variables.
#. Replace hard-coded ``http://localhost:8080`` references in the webapp bundle
   with the configured deployment URL.
#. Mount static middleware and JSON body parsers.
#. Call ``register(app)`` from :file:`routes.ts` to attach API endpoints.
#. Start listening on port 8080 and pass upgrade events to the
   ``CollaborationService`` for WebSocket support.

Port configuration
------------------

* Default HTTP port: **8080** (defined in ``server.ts``).
* Use reverse proxies (nginx, Traefik) or environment-specific process managers to
  expose the service on alternative ports.

Error handling
--------------

* Express-level errors propagate to Sentry when available.
* ``ErrorPanel`` in the front-end surfaces server-side errors returned via JSON
  responses.
* Build-time replacements ensure share links display correct origins to avoid
  mixed content issues.

Extending the server
--------------------

* Add new routes by editing :file:`packages/server/src/main/routes.ts` and
  attaching controllers.
* Introduce middleware (authentication, rate limiting) by wrapping the Express
  instance prior to route registration.
* Integrate additional services under ``packages/server/src/main/services`` and
  inject them where required.

Deployment artifacts
--------------------

* ``Dockerfile`` and ``Dockerfile.redis`` build production images.
* ``docker-compose.yml`` orchestrates the server alongside Redis for local
  testing.
* ``BESSER_WME_Standalone.service`` defines a systemd unit for Linux hosts.

Next steps
----------

Review :doc:`rest-api` for endpoint documentation.
