Data flow
=========

This section traces how information moves through the system during common
scenarios.

Diagram creation and persistence
--------------------------------

1. A user creates or edits elements in ``ApollonEditorComponent``.
2. The component serialises the diagram and stores it in local storage while the
   user remains offline.
3. When the user clicks *Save* (or auto-save triggers), the webapp calls the
   server's ``/api/diagrams`` endpoint.
4. ``routes.ts`` delegates to ``DiagramService.saveDiagramVersion`` which either
   creates a new token or appends a version to an existing diagram.
5. The configured storage adapter (filesystem or Redis) persists the diagram via
   ``DiagramStorageService``.
6. The server responds with the canonical diagram payload and share token, which
   is cached client-side for quick access.

Real-time collaboration
-----------------------

* Clients connect to the ``CollaborationService`` WebSocket endpoint (upgraded in
  ``server.ts``).
* Diagram changes are broadcast as JSON patches. Storage adapters (``DiagramStorageRateLimiter``)
  debounce write operations to avoid overwhelming the backing store.
* New clients replay the latest persisted model before subscribing to live
  updates.

Export pipeline
---------------

* When a user requests an export, the webapp sends the diagram payload to the
  conversion service.
* ``conversion-service`` orchestrates rendering to PNG, SVG, or PDF, relying on
  native libraries bundled via ``node-canvas``.
* The resulting binary is streamed back to the client for download.

Template bootstrapping
----------------------

* Selecting a template loads JSON from the ``templates`` directory.
* ``ApollonEditorComponent`` initialises the modelling engine with the template
  state and metadata.
* Version history records the template origin to maintain traceability.

Monitoring and analytics
------------------------

* Client events flow to PostHog when ``POSTHOG_KEY`` is configured.
* Server-side exceptions are captured by Sentry when ``SENTRY_DSN`` is set.
* Infrastructure metrics (CPU, memory) can be collected by the hosting platform
  or container orchestrator.

Next steps
----------

Dive into :doc:`../backend/index` for API surface details or :doc:`../frontend/index`
for the React component architecture.
