State management
================

The web application uses Redux Toolkit to manage global state. ``ApplicationStore``
(:file:`packages/webapp/src/main/components/store/application-store.tsx`) wraps
the app in a Redux provider with multiple feature slices.

Slices
------

``diagramSlice``
    Tracks the active diagram, editor options, loading flags, and unpublished
    state. Provides async thunks (``updateDiagramThunk``) to synchronise diagram
    changes with project storage.
``projectSlice``
    Manages project metadata, diagrams grouped by type, and active selections.
``errorManagementSlice``
    Collects errors surfaced by API calls or UI interactions so ``ErrorPanel`` can
    display them.
``modalSlice``
    Controls visibility of modal dialogs (share, templates, settings).
``shareSlice``
    Stores share link metadata, tokens, and collaboration options.
``versionManagementSlice``
    Handles retrieval and manipulation of diagram version histories.

Asynchronous workflows
----------------------

* ``updateDiagramThunk`` merges updates, timestamps changes, and dispatches
  ``updateCurrentDiagramThunk`` to keep project storage in sync.
* Additional thunks fetch diagrams by token, publish versions, and delete
  versions via the REST API.
* Error handling uses rejected actions to populate ``errorManagementSlice``.

Local storage integration
-------------------------

* ``ProjectStorageRepository`` persists projects in browser storage, enabling the
  home modal to list recent diagrams.
* ``LocalStorageRepository`` tracks published tokens for quick export and share
  operations.

Selector patterns
-----------------

* Use ``useSelector`` hooks to pull slices into components.
* Memoise derived state (diagram counts, filtered versions) with ``createSelector``
  when necessary.

Debugging tools
---------------

* Redux DevTools are enabled in non-production builds.
* Log asynchronous flows by attaching middleware or leveraging Redux Toolkit's
  built-in development warnings.

Next steps
----------

Explore :doc:`component-catalog` to see how state is consumed across the UI.
