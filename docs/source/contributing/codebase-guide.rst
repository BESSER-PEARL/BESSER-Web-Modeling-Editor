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
   │   ├── patcher/             #   JSON Patch for collaboration
   │   ├── layouter/            #   Auto-layout algorithms
   │   ├── undo/                #   Undo/redo stack
   │   └── editor/              #   Editor lifecycle management
   ├── i18n/                    # Translation files (en.json, de.json, ...)
   └── utils/                   # Pure utility functions

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


Web Application (``packages/webapp2``)
--------------------------------------

The webapp is the React SPA deployed at editor.besser-pearl.org. It embeds
the editor and adds project management, code generation, deployment, and
collaboration.

.. code-block:: text

   packages/webapp2/src/main/
   ├── app/                        # Application shell
   │   ├── application.tsx         #   Root component (routing, modals, layout)
   │   ├── shell/                  #   Top bar, sidebar, menus
   │   │   ├── WorkspaceTopBar.tsx #     File, Generate, Deploy, Community, Help menus
   │   │   ├── WorkspaceSidebar.tsx#     Diagram type navigation + settings
   │   │   ├── WorkspaceShell.tsx  #     Layout container
   │   │   └── menus/             #     Individual menu components
   │   │       ├── FileMenu.tsx
   │   │       ├── GenerateMenu.tsx
   │   │       ├── DeployMenu.tsx
   │   │       ├── CommunityMenu.tsx
   │   │       ├── HelpMenu.tsx
   │   │       └── TopBarUtilities.tsx  # Quality Check, Theme, GitHub, Sync
   │   ├── store/                  #   Redux store
   │   │   ├── workspaceSlice.ts   #     Unified project + diagram state
   │   │   └── errorManagementSlice.ts
   │   └── hooks/                  #   App-level React hooks
   ├── features/                   # Feature modules (one folder per feature)
   │   ├── editors/                #   Editor wrappers
   │   │   └── uml/ApollonEditorComponent.tsx  # Main editor wrapper
   │   ├── project/                #   Project hub, creation, templates
   │   ├── generation/             #   Code generation dialogs and logic
   │   ├── deploy/                 #   Render deployment
   │   ├── github/                 #   GitHub OAuth and deploy-to-repo
   │   ├── import/                 #   Import dialogs (file, image, KG)
   │   ├── export/                 #   Export dialogs (BUML, JSON, SVG, PDF)
   │   ├── agent-config/           #   Agent-specific configuration
   │   ├── assistant/              #   AI agent widget (bot icon)
   │   └── onboarding/             #   Tutorial / first-use flow
   ├── shared/                     # Cross-feature shared code
   │   ├── types/project.ts        #   BesserProject, ProjectDiagram types
   │   ├── constants/constant.ts   #   Environment variables, URLs, keys
   │   ├── services/               #   Storage, validation, analytics
   │   │   └── storage/ProjectStorageRepository.ts
   │   ├── components/             #   Reusable UI components
   │   ├── hooks/                  #   Shared React hooks
   │   ├── dialogs/                #   Shared dialog components
   │   ├── api/                    #   Backend API client functions
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

The Express server is lightweight. It serves the compiled webapp and provides
a few API endpoints.

.. code-block:: text

   packages/server/src/main/
   ├── server.ts              # Express app setup, middleware, route mounting
   ├── routes.ts              # API routes (/api/diagrams, /api/collaborate, etc.)
   ├── services/              # Business logic
   │   ├── diagram-service/   #   CRUD for diagrams (file or Redis storage)
   │   └── pdf-service/       #   SVG-to-PDF conversion
   ├── resources/             # Static assets
   ├── constants.ts           # Port, storage paths
   └── utils.ts               # Shared helpers

**Key patterns:**

- Diagrams are stored on the filesystem by default (``diagrams/`` folder).
  When ``APOLLON_REDIS_URL`` is set, storage switches to Redis.
- The server does NOT run code generation — that is handled by the BESSER
  Python backend at ``BACKEND_URL``.
- WebSocket connections for collaboration are managed through the server.


Where Code Lives: Quick Lookup
-------------------------------

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - I want to change...
     - Look in...
   * - A top-bar menu item
     - ``webapp2/src/main/app/shell/menus/``
   * - The sidebar (diagram type navigation)
     - ``webapp2/src/main/app/shell/WorkspaceSidebar.tsx``
   * - Project creation / import / export
     - ``webapp2/src/main/features/project/``
   * - Code generation dialogs
     - ``webapp2/src/main/features/generation/``
   * - GitHub deploy / OAuth
     - ``webapp2/src/main/features/github/``
   * - The AI assistant bot
     - ``webapp2/src/main/features/assistant/``
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
     - ``editor/src/main/i18n/en.json``
   * - Environment variables
     - ``webapp2/src/main/shared/constants/constant.ts``
   * - Project data model
     - ``webapp2/src/main/shared/types/project.ts``
   * - Local storage persistence
     - ``webapp2/src/main/shared/services/storage/ProjectStorageRepository.ts``
   * - Server diagram storage
     - ``server/src/main/services/diagram-service/``
