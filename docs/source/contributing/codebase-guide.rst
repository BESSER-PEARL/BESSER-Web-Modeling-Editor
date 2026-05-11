Understanding the Codebase
==========================

This guide explains the internal structure of each package so you know where
to find things and where your changes should go.


Library Package (``packages/library``)
--------------------------------------

The editor library is the core modeling engine. Built on React Flow + Zustand,
it is published as ``@besser/wme`` on npm. The webapp embeds it, but external
applications can use it directly.

.. code-block:: text

   packages/library/lib/
   ├── besser-editor.tsx        # Public API (BesserEditor class)
   ├── index.tsx                # npm entry point — re-exports public types
   ├── nodes/                   # React Flow node components per diagram
   │   ├── classDiagram/        #   Class, AbstractClass, Interface, Enumeration, OCL
   │   ├── objectDiagram/       #   Object instances, links
   │   ├── stateMachineDiagram/ #   States, transitions, initial/final nodes
   │   ├── agentDiagram/        #   Agent states, intents, transitions
   │   ├── nnDiagram/           #   NN container, layers, references
   │   ├── userDiagram/         #   User-modelling nodes
   │   └── common/              #   Shared node wrappers / handles
   ├── edges/                   # React Flow edge renderers and connection logic
   │   ├── edgeTypes/           #   ClassDiagramEdge, StateMachineDiagramEdge, …
   │   ├── EdgeProps.ts         #   Shared edge data types
   │   └── Connection.ts        #   Routing helpers
   ├── components/
   │   ├── inspectors/          # Property panels per diagram type
   │   ├── popovers/            # PopoverManager + per-edge popovers
   │   ├── svgs/                # Palette preview SVGs
   │   ├── toolbars/            # Node / canvas toolbars
   │   └── ui/                  # Shared inputs, dividers, dropdowns
   ├── store/                   # Zustand stores
   │   ├── diagramStore.ts      #   Nodes / edges / selection (Yjs-backed)
   │   ├── metadataStore.ts     #   Diagram name, type, mode, view
   │   ├── popoverStore.ts      #   Active popover / inspector state
   │   ├── assessmentSelectionStore.ts
   │   ├── alignmentGuidesStore.ts
   │   └── context.tsx          #   React context providers + hooks
   ├── services/                # Domain logic (NO UI)
   │   ├── diagramBridge.ts     #   Cross-diagram data sharing
   │   ├── settingsService.ts   #   Application settings
   │   ├── errors.ts            #   BesserError broadcast channel
   │   └── userMetaModel/       #   User-Diagram reference metamodel
   ├── sync/                    # Yjs collaboration adapter
   ├── types/                   # DiagramType + per-node data shapes
   ├── utils/                   # Pure utility functions
   │   ├── versionConverter.ts  #   v3 → v4 migrator
   │   ├── helpers.ts           #   React Flow / B-UML adapters
   │   ├── classifierMemberDisplay.ts
   │   ├── multiplicity.ts
   │   ├── typeNormalization.ts
   │   └── layoutUtils.ts
   ├── hooks/                   # React hooks (useConnect, useEdges, …)
   ├── App.tsx                  # Top-level React Flow root
   └── constants.ts             # Layout constants, palette sizes, grid snap

**Key patterns:**

- Each diagram folder contains the node components plus an ``index.ts`` that
  registers them under their v4 ``node.type`` strings. Edge renderers live in
  ``edges/edgeTypes/``. Inspector panels live in
  ``components/inspectors/<diagramType>/``.
- The library uses Zustand for state management, not Redux. Stores are created
  in ``store/`` and consumed via the context hooks in ``store/context.tsx``.
- The public API (``besser-editor.tsx`` + ``index.tsx``) is the ONLY stable
  interface. Internal modules can change without notice.


Web Application (``packages/webapp``)
--------------------------------------

The webapp is the React SPA deployed at editor.besser-pearl.org. It embeds
the editor and adds project management, code generation, deployment, and
collaboration.

.. code-block:: text

   packages/webapp/src/main/
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
   │   │   └── uml/BesserEditorComponent.tsx  # Main editor wrapper
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
     - ``webapp/src/main/app/shell/menus/``
   * - The sidebar (diagram type navigation)
     - ``webapp/src/main/app/shell/WorkspaceSidebar.tsx``
   * - Project creation / import / export
     - ``webapp/src/main/features/project/``
   * - Code generation dialogs
     - ``webapp/src/main/features/generation/``
   * - GitHub deploy / OAuth
     - ``webapp/src/main/features/github/``
   * - The AI assistant bot
     - ``webapp/src/main/features/assistant/``
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
     - ``webapp/src/main/shared/constants/constant.ts``
   * - Project data model
     - ``webapp/src/main/shared/types/project.ts``
   * - Local storage persistence
     - ``webapp/src/main/shared/services/storage/ProjectStorageRepository.ts``
   * - Server diagram storage
     - ``server/src/main/services/diagram-service/``
