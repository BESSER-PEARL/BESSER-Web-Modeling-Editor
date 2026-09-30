Web Application
===============

The ``packages/webapp`` workspace is a React single-page application built with
Vite, Radix UI, and Tailwind CSS. It wraps the editor engine with project
management, the AI assistant, code generation, and deployment. It is the
application deployed at https://editor.besser-pearl.org.

Highlights
----------

* **Project-first experience** – users work on named projects that bundle up to
  five diagrams of each of the nine supported types (Class, Object, State
  Machine, Agent, User, GUI No-Code, Quantum Circuit, Neural Network, BPMN),
  stored in the browser via ``ProjectStorageRepository``.
* **Redux Toolkit architecture** – the store composes ``workspaceSlice``
  (``app/store/``), ``errorManagementSlice`` (``app/store/``) and
  ``specDrivenSlice`` (``features/spec-driven/state/``), with typed hooks in
  ``app/store/hooks.ts``.
* **AI assistant** – a WebSocket client (``features/assistant/services/
  AssistantClient.ts``) talks to the modeling-agent service at
  ``UML_BOT_WS_URL`` and applies the structured actions it returns to the
  canvas. See :doc:`../user-guide/ai-assistant`.
* **Spec-Driven Agent** – full-application generation streams over HTTP + SSE
  against the backend's ``/spec-driven/*`` endpoints
  (``features/spec-driven/``). See :doc:`../user-guide/spec-driven-agent`.
* **Code generation and deployment helpers** – hooks under
  ``features/generation/`` and ``features/deploy/`` call the BESSER backend
  (``BACKEND_URL``) to produce Django, SQL, SQLAlchemy, JSON Schema, agent and
  other artefacts.
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
   boundaries. ``store.ts`` also mounts the spec-driven slice under
   ``specDriven``.

``shared/services``
   Business logic for storage, validation, analytics, SSE streaming, telemetry
   and the unified LLM key store (``llmKeyStorage.ts``). Feature-specific logic
   (import, export, generation, assistant, spec-driven) lives under
   ``features/``.

``templates``
   Starter diagrams and static assets copied to the build.

Integration points
------------------

* **Editor API** – the webapp treats the editor as a controlled component. All
  meaningful edits flow through Redux slices (see :doc:`../editor/api`).
* **Server communication** – most HTTP requests go to ``BACKEND_URL`` (the
  BESSER Python backend) through ``shared/api/api-client.ts``. Only the
  assistant rate limiter and SVG conversion use the Express app's ``/api``
  routes. The assistant's WebSocket URL comes from ``UML_BOT_WS_URL``, falling
  back to a ``WS_PROTOCOL`` derived from ``DEPLOYMENT_URL``.
* **Local storage** – persistent state lives under keys prefixed by ``besser_``
  (for example, ``besser_project_<id>``). See :doc:`local-projects` for details.

Before modifying the webapp, familiarise yourself with the state shape defined
in ``app/store/workspaceSlice.ts`` and the reusable hooks in
``hooks/``. They are the backbone of the UI.
