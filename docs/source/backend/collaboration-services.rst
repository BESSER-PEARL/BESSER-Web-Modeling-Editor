Collaboration services
======================

The WebSocket layer enables real-time editing, presence tracking, and selection
broadcasting. ``CollaborationService`` orchestrates these capabilities.

WebSocket server
----------------

* ``CollaborationService`` initialises a ``ws`` server in no-server mode so that
  ``server.ts`` can upgrade HTTP requests when required.
* Client sockets receive a generated ``apollonId`` and heartbeat ping every
  2 seconds. Idle sockets are terminated to free resources.

Connection lifecycle
--------------------

* ``onConnection`` associates a client socket with a diagram token and broadcasts
  collaborator lists to other clients working on the same token.
* ``onConnectionLost`` removes disconnected clients and notifies remaining peers.
* ``onCollaboratorUpdate`` propagates metadata changes (name, colour) to peers.

Patch distribution
------------------

* ``onDiagramPatch`` persists the JSON patch via ``DiagramStorageService`` and
  broadcasts the change, including the originating collaborator.
* ``onSelection`` sends live cursor/selection updates to peers without persisting
  them.
* Rate-limited storage ensures patch bursts do not overwhelm the backend.

Payload structure
-----------------

Messages exchanged between client and server follow this structure::

  {
    "token": "diagram-token",
    "collaborator": { "name": "Alice", "color": "#FF0000" },
    "patch": { ... },
    "selection": { ... }
  }

Security and validation
-----------------------

* Tokens are validated client-side before establishing WebSocket connections.
* Add authentication by verifying cookies or headers within ``handleUpgrade``.
* Consider rate limiting or bounding message sizes to mitigate abuse.

Extensibility
-------------

* Extend collaboration metadata by updating the ``Collaborator`` interface in
  :file:`packages/shared` and adjusting message handlers.
* Integrate presence indicators in the UI by consuming collaborator lists from
  broadcast messages.

Monitoring
----------

* Log connection counts and patch rates to detect hot diagrams.
* Capture WebSocket errors via Sentry by wrapping message handlers in ``try``/``catch``.

Next steps
----------

Continue with :doc:`security-and-observability` to harden and monitor your server
deployment.
