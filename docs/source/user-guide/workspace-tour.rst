Workspace tour
==============

The editor interface is built around a React single-page application
(:file:`packages/webapp/src/main/application.tsx`). The layout balances the
canvas, navigation bars, context-sensitive sidebars, and modals.

Global navigation
-----------------

Application bar
    The application bar (:file:`packages/webapp/src/main/components/application-bar/application-bar.tsx`)
    collects project-level actions such as creating diagrams, switching themes,
    exporting assets, and invoking the share modal. The bar reflects the current
    connection mode. When ``APPLICATION_SERVER_VERSION`` is defined, share link
    generators appear directly in the menu.
Sidebar layout
    ``SidebarLayout`` wraps the main routes and injects contextual panels such as
    the version history sidebar and collaboration roster.
Home modal
    First-time visitors are greeted by ``HomeModal`` which offers quick entry
    points to templates, recently used diagrams, and onboarding tips.

Primary canvas
--------------

Apollon editor
    ``ApollonEditorComponent`` hosts the ``@besser/wme`` canvas. It is responsible
    for loading templates, synchronising local state with persistent storage, and
    forwarding toolbar events to the underlying modelling engine.
Version management
    ``VersionManagementSidebar`` displays the list of diagram revisions, their
    timestamps, and associated metadata. It integrates with the server's
    ``DiagramService`` to fetch and prune versions.

Supporting widgets
------------------

Error panel
    ``ErrorPanel`` aggregates client-side errors and connection issues. It
    surfaces problems such as failed save operations or template load failures.
UML Bot widget
    ``UMLBotWidget`` connects to ``UML_BOT_WS_URL`` to enable AI-assisted diagram
    generation and feedback. Configure the WebSocket endpoint via environment
    variables.
Firefox hint
    ``FirefoxIncompatibilityHint`` warns about browser-specific limitations and
    suggests alternative workflows when necessary.
Toast notifications
    ``ToastContainer`` provides transient success and failure messages across the
    application.

Routing and pages
-----------------

The application uses React Router to expose several routes:

``/``
    Main modelling workspace.
``/project-settings``
    Accessed through the sidebar, this view configures metadata such as project
    names, descriptions, and share permissions.
``/teampage``
    Lists team members, onboarding instructions, and ways to request access.
``/:token`` (planned)
    Collaboration routes that load diagrams by share token. This route is wired
    in ``ApollonEditorComponentWithConnection`` and activated when the backend is
    available.

Keyboard shortcuts and help
---------------------------

* Press ``Ctrl+/`` (``Cmd+/`` on macOS) to open the built-in shortcut overlay.
* Use ``?`` within the application bar to access documentation links and the bug
  report template defined in :file:`packages/webapp/src/main/constant.ts`.

Next steps
----------

Continue to :doc:`diagramming-basics` to explore palettes, selection tools, and
editing workflows.
