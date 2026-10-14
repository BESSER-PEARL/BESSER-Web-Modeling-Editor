Understanding the Codebase
==========================

This guide explains the internal structure of each package so you know where
to find things and where your changes should go.


Editor Package (``packages/editor``)
-------------------------------------

The editor is the core modeling engine. It is framework-independent (pure
TypeScript + React) and published as ``@besser/wme`` on npm. The webapp embeds
it, but external applications can use it directly.

.. code-block:: text

   packages/editor/src/main/
   ├── apollon-editor.ts        # Public API (ApollonEditor class)
   ├── index.ts                 # npm entry point — re-exports public types
   ├── packages/                # Diagram type implementations (one folder each)
   │   ├── uml-class-diagram/   #   Class, AbstractClass, Interface, Enumeration, OCL
   │   ├── uml-object-diagram/  #   Object instances, links
   │   ├── uml-state-diagram/   #   States, transitions, initial/final nodes
   │   ├── agent-state-diagram/ #   Agent states, intents, transitions
   │   ├── common/              #   Shared element logic
   │   ├── diagram-type.ts      #   Registry of all diagram types
   │   ├── uml-element-type.ts  #   Registry of all element types
   │   ├── uml-relationship-type.ts
   │   ├── components.ts        #   Maps element types → React renderers
   │   ├── uml-elements.ts      #   Maps element types → model classes
   │   ├── compose-preview.ts   #   Maps diagram types → palette previews
   │   └── popups.ts            #   Maps element types → property popups
   ├── components/              # UI: sidebar, canvas, keyboard listeners, update pane
   ├── scenes/                  # Top-level React trees (Application, Svg export)
   ├── services/                # Domain logic (NO UI)
   │   ├── diagram-bridge/      #   Cross-diagram data sharing
   │   ├── uml-element/         #   Element CRUD, selection, movement
   │   ├── uml-relationship/    #   Relationship CRUD
   │   ├── patcher/             #   JSON Patch diffing of the model
   │   ├── layouter/            #   Auto-layout algorithms
   │   ├── undo/                #   Undo/redo stack
   │   └── editor/              #   Editor lifecycle management
   ├── components/i18n/         # Editor-side translation wiring
   └── utils/                   # Pure utility functions

Translation *strings* for both packages live outside the workspaces, in
``packages/i18n/<locale>/{editor,webapp}.json`` (``en``, ``lb``, ``de``, ``fr``,
``es``, ``ca``). English is the source of truth and the runtime fallback.

**Key patterns:**

- Each diagram type folder contains: element model class, React component,
  palette preview, and optionally a popup and relationship types.
- The ``components.ts``, ``uml-elements.ts``, ``compose-preview.ts``, and
  ``popups.ts`` files are registries — when you add a new element, you must
  register it in all four.
- Services use Redux for state management. The store is composed in
  ``components/store/``.
- The public API (``apollon-editor.ts``) is the ONLY stable interface.
  Internal modules can change without notice.


Web Application (``packages/webapp``)
--------------------------------------

The webapp is the React SPA deployed at editor.besser-pearl.org. It embeds
the editor and adds project management, the AI assistant, code generation, and
deployment.

.. code-block:: text

   packages/webapp/src/main/
   ├── app/                        # Application shell
   │   ├── application.tsx         #   Root component (routing, modals, layout)
   │   ├── shell/                  #   Top bar, sidebar, menus
   │   │   ├── WorkspaceTopBar.tsx #     File, Generate, Deploy, Help menus
   │   │   ├── WorkspaceSidebar.tsx#     Diagram type navigation + settings
   │   │   ├── WorkspaceShell.tsx  #     Layout container
   │   │   └── menus/             #     Individual menu components
   │   │       ├── FileMenu.tsx
   │   │       ├── GenerateMenu.tsx
   │   │       ├── DeployMenu.tsx
   │   │       ├── HelpMenu.tsx
   │   │       └── TopBarUtilities.tsx  # Quality Check, Theme, GitHub, Sync
   │   ├── store/                  #   Redux store
   │   │   ├── workspaceSlice.ts   #     Unified project + diagram state
   │   │   ├── errorManagementSlice.ts
   │   │   └── (specDrivenSlice lives in features/spec-driven/state)
   │   └── hooks/                  #   App-level React hooks
   ├── features/                   # Feature modules (one folder per feature)
   │   ├── editors/                #   Editor wrappers + diagram tab strip
   │   │   └── uml/ApollonEditorComponent.tsx  # Main editor wrapper
   │   ├── project/                #   Project hub, settings, templates
   │   ├── generation/             #   Code generation dialogs and logic
   │   ├── deploy/                 #   Render deployment
   │   ├── github/                 #   GitHub sign-in, repo storage, push
   │   ├── import/                 #   Import dialogs (file, image, KG, BPMN XML)
   │   ├── export/                 #   Export dialogs (BUML, JSON, SVG, PNG, PDF)
   │   ├── agent-config/           #   Agent-specific configuration
   │   ├── assistant/              #   AI assistant (WebSocket client, converters)
   │   └── spec-driven/            #   Spec-Driven Agent runs (HTTP + SSE)
   ├── shared/                     # Cross-feature shared code
   │   ├── types/project.ts        #   BesserProject, ProjectDiagram types
   │   ├── constants/constant.ts   #   Environment variables, URLs, storage keys
   │   ├── perspectives.ts         #   Diagram-visibility presets
   │   ├── services/               #   Storage, validation, analytics, SSE,
   │   │   │                       #   telemetry, llmKeyStorage
   │   │   └── storage/ProjectStorageRepository.ts
   │   ├── components/             #   Reusable UI, incl. byok/LlmKeyDialog
   │   ├── hooks/                  #   Shared React hooks
   │   ├── dialogs/                #   Shared dialog components
   │   ├── i18n/                   #   react-i18next setup + language list
   │   ├── api/                    #   ApiClient (centralised fetch wrapper)
   │   └── utils/                  #   Pure utility functions
   └── templates/                  # Starter project templates

**Key patterns:**

- ``app/`` contains the shell (layout, menus, store). This is the entry point.
- ``features/`` follows the feature-folder pattern — each feature owns its
  components, hooks, and logic. Features should not import from other features.
- ``shared/`` contains code used by multiple features. If you need something
  in two features, move it here.
- The single ``workspaceSlice.ts`` manages all project and diagram state.
  There are no separate project/diagram slices.
- Menu components (``app/shell/menus/``) are where top-bar actions are defined.


Server (``packages/server``)
-----------------------------

The Express server is deliberately minimal. It serves the compiled webapp and
exposes two small endpoints.

.. code-block:: text

   packages/server/src/main/
   ├── server.ts                          # Express setup, static hosting, Sentry
   ├── routes.ts                          # Mounts /api
   ├── resources/
   │   ├── uml-agent-rate-limiter-resource.ts  # POST/DELETE /api/uml-agent/rate-limit/check
   │   └── svg-export-resource.ts              # POST /api/svg
   ├── services/
   │   ├── conversion-service/            #   SVG conversion helpers
   │   └── storage-service/               #   File-backed storage helper
   ├── constants.ts                       # Paths to build/webapp
   └── utils.ts                           # Shared helpers

**Key patterns:**

- The server does NOT run code generation, validation, or GitHub OAuth — all of
  that is handled by the BESSER Python backend at ``BACKEND_URL``.
- It does NOT talk to the modeling agent either; the browser opens that
  WebSocket directly (``UML_BOT_WS_URL``).
- The listening port is hardcoded to ``8080``.
- On start-up it rewrites literal ``http://localhost:8080`` strings inside
  ``build/webapp/*.js`` using ``DEPLOYMENT_URL`` — the one piece of runtime
  configuration in the whole frontend.

.. note::
   Real-time collaboration and server-side shared diagram storage (the
   ``diagram-service`` and the ``APOLLON_REDIS_*`` variables) have been removed.
   Projects are stored in the browser; see :doc:`../webapp/local-projects`.


Where Code Lives: Quick Lookup
-------------------------------

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - I want to change...
     - Look in...
   * - A top-bar menu item
     - ``webapp/src/main/app/shell/menus/``
   * - The sidebar (diagram type navigation)
     - ``webapp/src/main/app/shell/WorkspaceSidebar.tsx``
   * - Project creation / import / export
     - ``webapp/src/main/features/project/``
   * - Code generation dialogs
     - ``webapp/src/main/features/generation/``
   * - GitHub deploy / OAuth
     - ``webapp/src/main/features/github/``
   * - The AI assistant (chat, WebSocket client, diagram converters)
     - ``webapp/src/main/features/assistant/``
   * - The Spec-Driven Agent (full-app generation runs)
     - ``webapp/src/main/features/spec-driven/``
   * - The BYOK / API-key dialog
     - ``webapp/src/main/shared/components/byok/LlmKeyDialog.tsx``
   * - An element's visual appearance
     - ``editor/src/main/packages/<diagram-type>/<element>-component.tsx``
   * - An element's data model
     - ``editor/src/main/packages/<diagram-type>/<element>.ts``
   * - The palette for a diagram
     - ``editor/src/main/packages/compose-preview.ts``
   * - A property popup
     - ``editor/src/main/packages/popups.ts``
   * - Cross-diagram data (bridge)
     - ``editor/src/main/services/diagram-bridge/``
   * - Auto-layout
     - ``editor/src/main/services/layouter/``
   * - Undo/redo
     - ``editor/src/main/services/undo/``
   * - Translations
     - ``packages/i18n/<locale>/{editor,webapp}.json``
   * - Environment variables
     - ``webapp/src/main/shared/constants/constant.ts``
   * - Project data model
     - ``webapp/src/main/shared/types/project.ts``
   * - Local storage persistence
     - ``webapp/src/main/shared/services/storage/ProjectStorageRepository.ts``
   * - Browser project storage
     - ``webapp/src/main/shared/services/storage/``
