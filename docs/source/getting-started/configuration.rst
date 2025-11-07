Configuration
=============

BESSER WME Standalone exposes a number of environment variables and filesystem
locations that customise how the editor behaves in development and production.
This page summarises the knobs you are most likely to tune.

Environment variables
---------------------

``APPLICATION_SERVER_VERSION``
    Controls whether the front-end should expect a backend. Set to ``0`` when
    serving static assets only. Set to ``1`` to enable collaboration features in
    the UI. The value is read in :file:`packages/webapp/src/main/constant.ts` and
    injected at build time through Webpack.
``DEPLOYMENT_URL``
    Public base URL for the deployment. The value is used by the React
    application to compose API endpoints and WebSocket URLs and by the server to
    rewrite static assets with the correct origin.
``SENTRY_DSN``
    Optional. Enables error and performance telemetry for the collaboration
    server via `Sentry <https://sentry.io>`_. When present, the DSN is passed to
    :mod:`@sentry/node` during server bootstrap.
``APOLLON_REDIS_URL``
    Optional. When set, the server persists diagrams in Redis instead of the
    filesystem. The value must include credentials and port when applicable
    (example: ``redis://user:password@redis-host:6379``). Leaving the variable
    undefined switches to the filesystem storage adapter.
``APOLLON_REDIS_DIAGRAM_TTL``
    Optional. Human-readable TTL (``30d``, ``12h``) parsed using the ``ms``
    package. Diagrams expire automatically after the configured duration when
    stored in Redis.
``APOLLON_REDIS_MIGRATE_FROM_FILE``
    Optional flag that triggers the `MigratingStorageService` to seed Redis with
    diagrams stored in the filesystem on startup.

Filesystem locations
--------------------

``build/webapp``
    Output of the webapp bundle. Serve the :file:`index.html` file from this
    directory when hosting the application statically.
``build/server``
    Contains the compiled Express server once ``npm run build:server`` completes.
    The entrypoint is :file:`server.js`.
``diagrams``
    Default directory for filesystem-based storage. Ensure the collaboration
    server process can read and write to this path.
``packages/webapp/src/main/templates``
    Houses the template metadata and assets surfaced by the "Start from
    Template" dialog. New templates can be added here.

Runtime flags
-------------

The following npm scripts accept environment overrides:

``npm run build``
    Respects ``APPLICATION_SERVER_VERSION`` and ``DEPLOYMENT_URL`` to prepare the
    bundle for static or full-stack deployments.
``npm run start:server``
    Loads ``SENTRY_DSN`` and the Redis-related variables when initialising the
    Express app. The script also reads ``DEPLOYMENT_URL`` to adjust share links in
    the generated HTML bundle.
``npm run start:webapp``
    Uses ``DEPLOYMENT_URL`` to proxy API calls while in development. When unset,
    ``http://localhost:8080`` is assumed.

Configuration profiles
----------------------

* **Local evaluation** – set ``APPLICATION_SERVER_VERSION=0`` and leave Redis
  variables unset. Serve :file:`build/webapp` via ``npm run build:webapp``.
* **Full-stack development** – export ``APPLICATION_SERVER_VERSION=1`` and
  ``DEPLOYMENT_URL=http://localhost:8080``. Create a :file:`.env` file with the
  same values to avoid re-exporting variables.
* **Redis-backed production** – configure ``APOLLON_REDIS_URL`` and optionally
  ``APOLLON_REDIS_DIAGRAM_TTL``. Combine with reverse proxies that expose the
  ``DEPLOYMENT_URL`` you expect users to reach.

Advanced integrations
---------------------

For CI/CD pipelines, export the variables inline when invoking npm scripts::

  APPLICATION_SERVER_VERSION=1 DEPLOYMENT_URL=https://editor.example.com npm run build

Container deployments can copy environment variables into :file:`docker-compose.yml`
using the provided ``.env`` file template. See :doc:`../deployment/docker` for
examples.
