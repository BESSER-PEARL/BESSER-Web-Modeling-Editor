Web Application
===============

The ``packages/webapp`` workspace is a React single-page application built with
Vite, Radix UI, and Tailwind CSS. It wraps the editor engine with project
management, collaboration, and code generation features. It is the application
deployed at https://editor.besser-pearl.org.

Highlights
----------

* **Project-first experience** – users work on named projects that bundle
  multiple diagrams (Class, Object, State Machine, Agent, GUI, Quantum Circuit) stored in the browser
  via ``ProjectStorageRepository``.
* **Redux Toolkit architecture** – feature slices live under
  ``src/main/app/store`` (for example, ``workspaceSlice.ts`` and
  ``errorManagementSlice.ts``) with typed hooks in ``hooks/``.
* **Local-first collaboration** – collaboration components establish WebSocket
  connections to the Express server when the user enters a collaboration token.
  Diagram changes propagate through JSON Patch streams using the editor's
  patcher service.
* **Code generation and deployment helpers** – hooks in
  ``hooks/`` call the BESSER backend (`BACKEND_URL`) to produce
  Django, SQL, SQLAlchemy, JSON Schema, and agent artefacts.
* **Observability and analytics** – optional PostHog and Sentry integration via
  env-configured keys.

Directory tour
--------------

``src/main/app/application.tsx``
   Root component that wires routing, modals, the application bar, sidebar
   layout, project settings, and the editor containers.

``features/editors/uml/ApollonEditorComponent.tsx``
   React wrapper around ``ApollonEditor``. Handles local editing with
   autosave and palette integration.

``app/store``
   Redux slices: ``workspaceSlice.ts`` manages project, diagram, and editor
   state in a single unified slice. ``errorManagementSlice.ts`` handles error
   boundaries.

``shared/services``
   Business logic for storage, validation, analytics, and file operations.
   Feature-specific logic (import, export, generation) lives under ``features/``.

``templates``
   Starter diagrams and static assets copied to the build.

Integration points
------------------

* **Editor API** – the webapp treats the editor as a controlled component. All
  meaningful edits flow through Redux slices (see :doc:`../editor/api`).
* **Server communication** – HTTP requests target ``/api`` (served by the
  Express app) or ``BACKEND_URL`` for backend code generation. WebSockets reuse
  the ``WS_PROTOCOL`` derived from ``DEPLOYMENT_URL``.
* **Local storage** – persistent state lives under keys prefixed by ``besser_``
  (for example, ``besser_project_<id>``). See :doc:`local-projects` for details.

Before modifying the webapp, familiarise yourself with the state shape defined
in ``app/store/workspaceSlice.ts`` and the reusable hooks in
``hooks/``. They are the backbone of the UI.
