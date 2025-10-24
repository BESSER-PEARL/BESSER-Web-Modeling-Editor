System architecture
===================

BESSER WME Standalone is a monorepo of TypeScript packages orchestrated through
a npm workspace (:file:`package.json`). The architecture is divided into three
primary layers.

1. **Core modelling engine** – consumed from the ``@besser/wme`` npm package. It
   delivers diagram rendering, palette management, and editing operations.
2. **Web application** – housed under :file:`packages/webapp`. A React
   single-page application integrates the engine, templates, analytics, and
   routing. Webpack handles bundling and environment injection.
3. **Collaboration server** – located in :file:`packages/server`. An Express
   application serves the static assets, exposes REST APIs, and manages storage
   adapters for collaboration features.

Shared infrastructure
---------------------

* :file:`packages/shared` defines DTOs, validation helpers, and type guards. It
  ensures the webapp and server use the same contracts when exchanging diagrams.
* Root-level npm scripts orchestrate builds, linting, and development workflows
  across all packages (``npm run build``, ``npm run lint``, ``npm run dev``).
* ``tsconfig.json`` in each package extends the root configuration to align
  compiler options.

Data persistence
----------------

* File-based storage (``DiagramFileStorageService``) writes JSON blobs under the
  ``diagrams`` directory using a rate-limited queue.
* Redis-backed storage (``DiagramRedisStorageService``) leverages RedisJSON for
  structured persistence and optional TTL enforcement.
* ``MigratingStorageService`` bridges filesystem and Redis when migrating data.

Messaging and collaboration
---------------------------

* ``CollaborationService`` manages WebSocket upgrades, distributing JSON patches
  between clients.
* ``DiagramService`` handles version creation, metadata updates, and deletion
  requests, delegating persistence to the selected storage adapter.
* ``conversion-service`` pipelines export requests into image/PDF assets.

Front-end integration
---------------------

* ``ApplicationStore`` coordinates state across components via React context.
* ``ApollonEditorProvider`` exposes the underlying editor instance to nested
  components, allowing share modals and toolbars to interact with the canvas.
* Routing is implemented with ``react-router-dom`` to support multi-page flows.

Operational concerns
--------------------

* Dockerfiles for static hosting and Redis-backed deployments live at the root.
* ``docker-compose.yml`` spins up the webapp, server, and Redis services for
  local integration testing.
* Systemd service templates (``BESSER_WME_Standalone.service``) and cron jobs
  (``delete-stale-diagrams.cronjob.txt``) support traditional VM deployments.

Next steps
----------

Consult :doc:`package-map` for a closer look at each workspace package, or jump
to :doc:`../backend/index` for backend implementation details.
