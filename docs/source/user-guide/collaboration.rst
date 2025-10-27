Collaboration
=============

Pairing the web application with the collaboration server enables shared editing
sessions, persistent version history, and feedback workflows. This page covers
the user-facing features built on top of :mod:`packages/server`.

Share modes
-----------

Open the share dialog from the application bar to generate secure links for the
current diagram. The following modes mirror the behaviour of the production
service:

``Edit``
    Recipients can edit the diagram collaboratively. Changes are persisted as
    new versions through :class:`DiagramService <packages.server.src.main.services.diagram-service.diagram-service.DiagramService>`.
``Embed``
    Produces an embeddable URL suitable for documentation, Git issues, or other
    portals. The embed always renders the latest version.
``Give Feedback``
    Allows reviewers to annotate and comment without altering the canonical
    diagram.
``See Feedback``
    Displays collected feedback for review sessions.

Version history
---------------

Every save operation creates a new entry in the version sidebar. Versions store
metadata such as title, description, timestamp, and share tokens. Users can:

* Browse previous versions and restore them to the canvas.
* Edit metadata inline to document design rationale.
* Delete superseded versions. The server enforces data integrity when removing
  entries (see ``deleteDiagramVersion`` in ``DiagramService``).

Real-time collaboration
-----------------------

The server hosts a ``CollaborationService`` that upgrades HTTP connections to
WebSockets. Clients synchronise changes through patch streams handled by the
storage adapters. Ensure that port 8080 (or your customised port) is reachable by
participants.

Notifications and presence
--------------------------

When connected to the backend, the application bar shows collaborator presence
and connection health. Toast notifications indicate when someone else modifies
the diagram or when version history is updated remotely.

Security considerations
-----------------------

* Share tokens are generated using ``randomString`` with a configurable length
  (see ``tokenLength`` in :file:`packages/server/src/main/constants.ts`).
* Expire tokens automatically by configuring Redis with
  ``APOLLON_REDIS_DIAGRAM_TTL``.
* Enable ``SENTRY_DSN`` to capture audit trails and error reporting.

Troubleshooting
---------------

* If share links open but do not load the diagram, confirm that the server has
  access to the ``diagrams`` directory or Redis instance.
* For WebSocket issues, verify reverse proxy configurations forward ``Upgrade``
  and ``Connection`` headers.
* Check server logs for rate limiter messages when saving large diagrams.

Next steps
----------

Continue with :doc:`exporting-and-integration` to learn how to publish diagrams
outside of the application.
