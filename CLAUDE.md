# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Overview

BESSER Web Modeling Editor (WME) is the frontend for the BESSER low-code platform. It provides a browser-based visual editor for creating UML diagrams, GUI designs, agent models, quantum circuits, and more. The editor communicates with a Python/FastAPI backend for code generation, validation, and deployment.

- **Live**: https://editor.besser-pearl.org
- **Backend repo**: https://github.com/BESSER-PEARL/BESSER
- **This repo is vendored** into the backend as a git submodule at `besser/utilities/web_modeling_editor/frontend`

## Monorepo Structure

This is an npm workspaces monorepo with 3 packages:

| Package | Status | Purpose |
|---------|--------|---------|
| `packages/webapp` | **Active** | Main React SPA (Vite + React 18 + Tailwind + Radix UI) |
| `packages/library` | **Active** | Core diagramming engine (React Flow + Zustand), published as `@besser/wme` on npm |
| `packages/server` | **Active** | Express server for standalone hosting (serves built webapp) |

Almost all feature work happens in `webapp` and `library`.

## Essential Commands

```bash
# Install all dependencies (run from monorepo root)
npm install

# Development (starts Vite dev server on http://localhost:8080)
# Requires BESSER backend running at http://localhost:9000
npm run dev

# Build for production
npm run build              # Builds webapp + server
npm run build:webapp      # webapp only
npm run build:local        # Build with localhost backend URLs

# Testing
npm run test               # Vitest unit tests (webapp)
npm run test:e2e           # Playwright E2E tests
npm run test:e2e:ui        # E2E with interactive UI

# Linting & formatting
npm run lint               # ESLint (webapp + server)
npm run prettier:check     # Check formatting
npm run prettier:write     # Auto-format

# Standalone server (after building)
npm run start:server       # Express on http://localhost:8080
```

**Node requirement**: >= 20.0.0

## Architecture Overview

### Tech Stack
- **Build**: Vite 7 (webapp + library), Webpack (server)
- **Framework**: React 18.2 + React Router 6
- **Diagram engine**: React Flow (`@xyflow/react`) + Zustand (library package)
- **Webapp state**: Redux Toolkit (single `workspaceSlice` + `errorManagementSlice`)
- **UI**: Radix UI primitives + Tailwind CSS (class-based dark mode)
- **Editors**: BesserEditor (UML, from `@besser/wme`), GrapesJS (GUI no-code), custom (quantum circuits)
- **Collaboration**: Yjs (CRDT-backed shared documents, integrated in the library)
- **Testing**: Vitest + jsdom (unit), Playwright (E2E)
- **TypeScript**: 5.6, strict mode, ES2021 target

### Source Layout (webapp)

```
packages/webapp/src/main/
├── app/                        # Shell, routing, Redux store
│   ├── application.tsx         # Root: routes, providers, lazy dialogs
│   ├── shell/                  # TopBar, Sidebar, menus
│   └── store/                  # store.ts, workspaceSlice.ts, hooks.ts
├── features/                   # Feature modules (isolated)
│   ├── editors/                # EditorView + UML/GUI/quantum editors
│   ├── generation/             # Code generation dialogs & hooks
│   ├── deploy/                 # Render deployment
│   ├── github/                 # GitHub OAuth
│   ├── import/                 # Import dialogs
│   ├── export/                 # Export dialogs
│   ├── assistant/              # AI assistant widget + services
│   ├── agent-config/           # Agent configuration panels
│   ├── project/                # Project hub, settings, templates
│   └── onboarding/             # Tutorial flow
├── shared/                     # Cross-feature code
│   ├── api/                    # ApiClient (centralized HTTP)
│   ├── components/             # Reusable UI components
│   ├── constants/              # Environment vars, localStorage keys
│   ├── hooks/                  # Shared React hooks
│   ├── services/               # Storage, validation, analytics
│   ├── types/                  # TypeScript types (BesserProject, etc.)
│   └── utils/                  # Pure utilities
└── templates/                  # Starter project templates
```

### Library Package (packages/library)

The diagramming engine, built on React Flow + Zustand and published as
`@besser/wme`. Contains:

```
packages/library/lib/
├── besser-editor.tsx           # Public API (BesserEditor class)
├── index.tsx                   # npm entry point — re-exports public types
├── App.tsx                     # Top-level React Flow root
├── nodes/                      # React Flow node components per diagram
│   ├── classDiagram/           #   Class, AbstractClass, Interface, Enumeration, OCL
│   ├── objectDiagram/          #   Object instances, links
│   ├── stateMachineDiagram/    #   States, transitions, initial/final/fork/merge
│   ├── agentDiagram/           #   Agent states, intents, RAG, transitions
│   ├── nnDiagram/              #   NN container, layers, references
│   ├── userDiagram/            #   User-modelling nodes
│   ├── bpmn/                   #   BPMN tasks, events, gateways
│   ├── flowchart/              #   Flowchart shapes
│   └── common/                 #   Shared node wrappers / handles
├── edges/                      # React Flow edge renderers
│   ├── edgeTypes/              #   ClassDiagramEdge, StateMachineDiagramEdge, …
│   ├── EdgeProps.ts            #   Shared edge data types
│   └── Connection.ts           #   Routing helpers
├── components/
│   ├── inspectors/             # Property panels per diagram type
│   ├── popovers/               # PopoverManager + per-edge popovers
│   ├── svgs/                   # Palette preview SVGs
│   ├── toolbars/               # Node / canvas toolbars
│   └── ui/                     # Shared inputs, dividers, dropdowns
├── store/                      # Zustand stores
│   ├── diagramStore.ts         #   Nodes / edges / selection (Yjs-backed)
│   ├── metadataStore.ts        #   Diagram name, type, mode, view
│   ├── popoverStore.ts         #   Active popover / inspector state
│   ├── assessmentSelectionStore.ts
│   ├── alignmentGuidesStore.ts
│   └── context.tsx             #   React context providers + hooks
├── services/                   # Domain logic (NO UI)
│   ├── diagramBridge.ts        #   Cross-diagram data sharing
│   ├── settingsService.ts      #   Application display settings
│   ├── errors.ts               #   BesserError broadcast channel
│   └── userMetaModel/          #   User-Diagram reference metamodel
├── sync/                       # Yjs collaboration adapter (YjsSyncClass)
├── types/                      # DiagramType + per-node data shapes
├── utils/                      # Pure utility functions
│   ├── versionConverter.ts     #   v3 → v4 migrator
│   ├── helpers.ts              #   React Flow / B-UML adapters
│   ├── classifierMemberDisplay.ts
│   ├── multiplicity.ts
│   ├── typeNormalization.ts
│   └── layoutUtils.ts
├── hooks/                      # React hooks (useConnect, useEdges, …)
└── constants.ts                # Layout constants, palette sizes, grid snap
```

## Key Patterns

### Feature Isolation
Features in `src/main/features/` must NOT import from other features. Use `shared/` for cross-feature code. Each feature owns its own hooks, components, and dialogs.

### Redux State Management
All project/diagram state lives in a single `workspaceSlice`. Key patterns:
- Async thunks for state mutations (they also persist to `ProjectStorageRepository`)
- Use `withoutNotify()` when writing to storage from thunks (prevents infinite sync loops)
- `editorRevision` counter triggers editor reinitialization when bumped
- Typed hooks: `useAppDispatch()` and `useAppSelector()` from `store/hooks.ts`

### Path Aliases (webapp)
Configured in `tsconfig.json` and `vite.config.ts`:
- `@/` → `src/`
- `@besser/wme` → `../library/lib/index.tsx` (local dev, npm in production)
- `shared` → `../shared/src/index.ts`
- `webapp/*` → `./*`

### API Communication
All backend calls go through `shared/api/api-client.ts`:
- Singleton `apiClient` with 30s timeout
- Methods: `get()`, `post()`, `upload()` (FormData), `downloadBlob()` (binary)
- Custom `ApiError` class with HTTP status
- Backend URL: `http://localhost:9000/besser_api` in dev, configured via env in production

### LocalStorage Keys
All prefixed with `besser_`:
- `besser_projects` / `besser_latest_project` - project storage
- `besser_diagrams` / `besser_latest` - legacy diagram storage
- `besser_userThemePreference` - dark/light mode
- `besser_agentConfigs` / `besser_agentProfileMappings` - agent state
- `besser_userProfiles` - saved per-user UML profile snapshots used for agent personalization variants
- `besser_activeAgentConfiguration` - id of the currently active stored agent configuration
- `besser_agentBaseModels` - per-AgentDiagram base (pre-personalization) UML model snapshots, keyed by diagram id
- `besser_deploy_linked_<projectId>_<target>` - per-project, per-target ({owner, repo}) of the last successful Render deploy
- `besser-standalone-settings` - application display settings (managed by `settingsService`), including `classNotation: 'UML' | 'ER'` which selects the class-diagram rendering flavor (pure rendering — no metamodel change)

> **Deprecated (v7.3.0):** `besser_systemConfig` was removed as a top-level localStorage key. Agent runtime config (platform, intent-recognition technology, LLM provider/model) now lives on the agent diagram itself (`AgentDiagram.config`) — single source of truth. The v3 storage migration deletes the legacy key on next launch.

### Global Display Settings (settingsService)
`packages/library/lib/services/settingsService.ts` holds display preferences in localStorage under `besser-standalone-settings`. Rendering components read these **synchronously at render time** (e.g. `settingsService.shouldShowAssociationNames()`), they don't subscribe. For a toggle to actually repaint the canvas live, mirror the relevant field into Zustand state via `settingsService.onSettingsChange` — the `setState` call is what forces the subtree to re-render. Don't bump `editorRevision` for view-only toggles — that clears undo history.

### Node and Edge Rendering
The library renders diagrams via React Flow: every node has a custom component under `packages/library/lib/nodes/<diagramType>/` and every edge has a renderer under `packages/library/lib/edges/edgeTypes/`. Node components use plain SVG inside a `<DefaultNodeWrapper>` (which owns the selection / drag handles). Theme-aware colours flow through CSS variables (`--besser-background`, `--besser-primary-contrast`, `--besser-gray`, …) — raw SVG primitives bypass the theme, so always provide a fallback when reading `data.strokeColor` / `data.fillColor`:
```tsx
stroke={data.strokeColor || 'var(--besser-primary-contrast, #000)'}
fill={data.fillColor || 'white'}
```

## Adding a New Diagram Element

To add a new node type, create the React Flow node component under
`packages/library/lib/nodes/<diagramType>/<YourNode>.tsx` and register it in
that folder's `index.ts`. Then:

1. **Add the data shape** to `packages/library/lib/types/nodes/NodeProps.ts` (`YourNodeProps` extending `DefaultNodeProps`).
2. **Add an inspector panel** in `packages/library/lib/components/inspectors/<diagramType>/<YourNode>EditPanel.tsx` and register it in the inspector `index.ts`.
3. **Add a palette preview** in `packages/library/lib/components/svgs/nodes/<diagramType>/<YourDiagram>SVGs.tsx`.
4. **Route the popover** in `packages/library/lib/components/popovers/PopoverManager.tsx`.

If the new node is an edge, mirror the steps under `packages/library/lib/edges/edgeTypes/` and `packages/library/lib/components/inspectors/<diagramType>/<YourEdge>EditPanel.tsx`.

## Adding a New Diagram Type

1. Add an entry to `packages/library/lib/types/DiagramType.ts` (`UMLDiagramType` enum).
2. Create the diagram folder under `packages/library/lib/nodes/<yourDiagram>/` and add the per-node components plus an `index.ts`.
3. Create matching edges under `packages/library/lib/edges/edgeTypes/` if you introduce new relationship kinds.
4. Add inspector panels under `packages/library/lib/components/inspectors/<yourDiagram>/`.
5. Register palette previews + routing as described in "Adding a New Diagram Element".
6. Add a `case` to `packages/library/lib/utils/versionConverter.ts` if legacy fixtures need to be lifted to v4.
7. Add editor support in `packages/webapp/src/main/features/editors/`.
8. Add the diagram type to the backend's supported types if it needs generation / validation.

## Supported Diagram Types

ClassDiagram, ObjectDiagram, StateMachineDiagram, AgentDiagram, UserDiagram, ActivityDiagram, UseCaseDiagram, CommunicationDiagram, ComponentDiagram, DeploymentDiagram, PetriNet, ReachabilityGraph, SyntaxTree, Flowchart, BPMN

Of these, the backend currently supports generation/validation for: ClassDiagram, ObjectDiagram, StateMachineDiagram, AgentDiagram, UserDiagram, GUINoCodeDiagram, QuantumCircuitDiagram.

## Environment Variables

Set at build time via Vite's `define` (in `vite.config.ts`):

| Variable | Dev Default | Purpose |
|----------|-------------|---------|
| `BACKEND_URL` | `http://localhost:9000/besser_api` | Python backend API |
| `DEPLOYMENT_URL` | - | Public URL of the deployed app |
| `UML_BOT_WS_URL` | `ws://localhost:8765` | AI assistant WebSocket |
| `POSTHOG_HOST` / `POSTHOG_KEY` | - | Analytics (optional) |
| `SENTRY_DSN` | - | Error tracking (optional) |
| `GITHUB_CLIENT_ID` | - | GitHub OAuth (optional) |

For local development, only `BACKEND_URL` matters and it defaults correctly.

## Cross-Repo Workflow (Frontend + Backend)

This repo is vendored into the BESSER backend as a git submodule. When making changes that span both repos:

1. Make frontend changes in this repo, push to a branch
2. Make backend changes in the BESSER repo
3. Update the submodule pointer in BESSER: `cd besser/utilities/web_modeling_editor/frontend && git checkout your-branch`
4. Stage the submodule change in BESSER: `git add besser/utilities/web_modeling_editor/frontend`
5. Link both PRs and note the merge order

When you see `M besser/utilities/web_modeling_editor/frontend` in the parent repo's git status, it means the submodule pointer has moved.

## Testing Approach

- **Unit tests**: Vitest with jsdom. Config in `vitest.config.ts`, setup in `src/test/setup.ts`
- **E2E tests**: Playwright. Run from `packages/webapp` (not the monorepo root) with `npm run test:e2e`
- **Linting**: ESLint (permissive — `any` and `ts-ignore` are warnings, not errors)
- **Formatting**: Prettier (check with `npm run prettier:check`)

## Important Conventions

### Code Style
- TypeScript strict mode
- Tailwind for styling (no inline styles or CSS modules in webapp)
- Radix UI for accessible primitives (Dialog, DropdownMenu, Tooltip, etc.)
- ESLint warnings are acceptable but errors must be fixed
- `_` prefix for intentionally unused variables

### Editor Engine
- The editor (`@besser/wme`) is designed as a standalone library — webapp is one consumer
- Editor uses Redux internally (separate from webapp's Redux store)
- styled-components used inside editor package (legacy, not Tailwind)
- Custom Jinja-style delimiters (`[[` / `]]`) not applicable here — that's the backend React generator

### GUI Editor
- Uses GrapesJS (drag-and-drop page builder)
- Custom component registrars in `features/editors/gui/component-registrars/`
- Chart widgets use Recharts library
- State synced to Redux via `useStorageSync()` hook

### Quantum Circuit Editor
- Fully custom canvas-based editor
- Gate definitions in `features/editors/quantum/gates/`
- No external library dependency

## Common Pitfalls

1. **Feature cross-imports**: Never import from one feature into another. Move shared code to `shared/`
2. **Editor reinit**: Changing `editorRevision` in Redux causes a full editor remount. Only bump it for structural changes (switching diagram types, not for model updates)
3. **Storage sync loops**: When writing to `ProjectStorageRepository` from a thunk, use `withoutNotify()` to prevent the storage listener from re-dispatching
4. **Path aliases**: If adding new aliases, update both `tsconfig.json` and `vite.config.ts`
5. **Backend contract changes**: If you change backend API endpoints or request/response shapes, update the corresponding API calls in `shared/api/` and any Pydantic models in the backend
