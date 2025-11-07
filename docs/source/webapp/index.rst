Web Application
===============

The ``packages/webapp`` workspace is a React single-page application that wraps
the editor engine with project management, collaboration, and code generation
features. It is the application deployed at
https://editor.besser-pearl.org.

Highlights
----------

* **Project-first experience** – users work on named projects that bundle
  multiple diagrams (Class, Object, State Machine, Agent) stored in the browser
  via ``ProjectStorageRepository``.
* **Redux Toolkit architecture** – feature slices live under
  ``src/main/services`` (for example, ``diagramSlice.ts`` and
  ``projectSlice.ts``) with typed hooks in ``components/store``.
* **Local-first collaboration** – collaboration components establish WebSocket
  connections to the Express server when the user enters a collaboration token.
  Diagram changes propagate through JSON Patch streams using the editor's
  patcher service.
* **Code generation and deployment helpers** – hooks in
  ``services/generate-code`` call the BESSER backend (`BACKEND_URL`) to produce
  Django, SQL, SQLAlchemy, JSON Schema, and agent artefacts.
* **Observability and analytics** – optional PostHog and Sentry integration via
  env-configured keys.

Directory tour
--------------

``src/main/application.tsx``
   Root component that wires routing, modals, the application bar, sidebar
   layout, project settings, and the editor containers.

``components/apollon-editor-component``  
   React wrappers around ``ApollonEditor``. ``ApollonEditorComponent`` handles
   local editing, while ``ApollonEditorComponentWithConnection`` adds
   WebSocket-based collaboration.

``services``  
   Business logic split by domains (diagram, project, import/export, share,
   generate-code, validation, storage). Each service exposes Redux slices,
   repositories, or hooks with a consistent naming convention.

``templates`` and ``assets``  
   Provide starter diagrams, UI icons, and static images copied to the build.

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
in ``services/project/projectSlice.ts`` and the reusable hooks in
``components/store/hooks.ts``. They are the backbone of the UI.
