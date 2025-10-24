Component catalog
=================

Key React components live under :file:`packages/webapp/src/main/components`.
This catalog highlights the most important modules and their responsibilities.

Layout
------

``ApplicationBar``
    Global navigation bar with menus for files, templates, sharing, export, and
    settings.
``SidebarLayout``
    Wraps the canvas with auxiliary panels such as version management and project
    settings.
``VersionManagementSidebar``
    Displays version history, metadata editing forms, and share link shortcuts.

Editor integration
------------------

``ApollonEditorComponent``
    Hosts the modelling canvas, manages initialisation, and syncs with Redux
    state.
``ApollonEditorComponentWithConnection``
    Extends the base component with server-backed collaboration and WebSocket
    handling.
``ApollonEditorProvider``
    Context provider exposing the ``ApollonEditor`` instance to children.

Modals
------

``HomeModal``
    Entry point for selecting templates, creating projects, and resuming recent
    work.
``ShareModal``
    Generates share links, toggles share modes, and displays embed snippets.
``ApplicationModal``
    Container for global modals triggered by menu commands.

Supporting views
----------------

``ProjectSettingsScreen``
    Manages project metadata, default diagram types, and team settings.
``TeamPage``
    Static page for listing contributors, support channels, and collaboration
    guidelines.
``ErrorPanel``
    Persistent component surfacing backend or UI errors from the Redux store.

Integration widgets
-------------------

``UMLBotWidget``
    Interfaces with ``UML_BOT_WS_URL`` to provide AI-assisted modelling features.
``FirefoxIncompatibilityHint``
    Offers alternative workflows when browser compatibility issues are detected.
``ToastContainer``
    Renders toast notifications triggered throughout the application.

Styling
-------

* Components import CSS modules or global styles from :file:`styles.css`.
* Theme-aware components respect ``localStorageUserThemePreference`` and
  ``localStorageSystemThemePreference``.

Extending the catalog
---------------------

* Follow existing folder conventions when adding components (co-locate tests and
  storybook docs if used).
* Export new components via index files for easier imports elsewhere in the app.

Next steps
----------

Visit :doc:`styling-and-theming` for details on the styling pipeline.
