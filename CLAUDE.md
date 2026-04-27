# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Overview

BESSER Web Modeling Editor (WME) is the frontend for the BESSER low-code platform. It provides a browser-based visual editor for creating UML diagrams, GUI designs, agent models, quantum circuits, and more. The editor communicates with a Python/FastAPI backend for code generation, validation, and deployment.

- **Live**: https://editor.besser-pearl.org
- **Backend repo**: https://github.com/BESSER-PEARL/BESSER
- **This repo is vendored** into the backend as a git submodule at `besser/utilities/web_modeling_editor/frontend`

## Monorepo Structure

This is an npm workspaces monorepo with 4 packages:

| Package | Status | Purpose |
|---------|--------|---------|
| `packages/webapp2` | **Active** | Main React SPA (Vite + React 18 + Tailwind + Radix UI) |
| `packages/editor` | **Active** | Core diagramming engine, published as `@besser/wme` on npm |
| `packages/server` | **Active** | Express server for standalone hosting (serves built webapp2) |
| `packages/webapp` | **Legacy** | Old Webpack + Bootstrap app. Reference only, do not modify |

Almost all feature work happens in `webapp2` and `editor`.

## Essential Commands

```bash
# Install all dependencies (run from monorepo root)
npm install

# Development (starts Vite dev server on http://localhost:8080)
# Requires BESSER backend running at http://localhost:9000
npm run dev

# Build for production
npm run build              # Builds webapp2 + server
npm run build:webapp2      # webapp2 only
npm run build:local        # Build with localhost backend URLs

# Testing
npm run test               # Vitest unit tests (webapp2)
npm run test:e2e           # Playwright E2E tests
npm run test:e2e:ui        # E2E with interactive UI

# Linting & formatting
npm run lint               # ESLint (webapp2 + server)
npm run prettier:check     # Check formatting
npm run prettier:write     # Auto-format

# Standalone server (after building)
npm run start:server       # Express on http://localhost:8080
```

**Node requirement**: >= 20.0.0

## Architecture Overview

### Tech Stack
- **Build**: Vite 7 (webapp2), Webpack (server, editor)
- **Framework**: React 18.2 + React Router 6
- **State**: Redux Toolkit (single `workspaceSlice` + `errorManagementSlice`)
- **UI**: Radix UI primitives + Tailwind CSS (class-based dark mode)
- **Editors**: ApollonEditor (UML), GrapesJS (GUI no-code), custom (quantum circuits)
- **Testing**: Vitest + jsdom (unit), Playwright (E2E)
- **TypeScript**: 5.6, strict mode, ES2021 target

### Source Layout (webapp2)

```
packages/webapp2/src/main/
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

### Editor Package (packages/editor)

The diagramming engine, published as `@besser/wme`. Contains:

```
packages/editor/src/main/
├── apollon-editor.ts           # Public API (ApollonEditor class)
├── packages/                   # Diagram-specific implementations
│   ├── uml-class-diagram/      # Class diagram elements
│   ├── uml-object-diagram/     # Object diagram elements
│   ├── uml-state-diagram/      # State machine elements
│   ├── agent-state-diagram/    # Agent diagram elements
│   ├── flowchart/              # Flowchart elements
│   ├── bpmn/                   # BPMN elements
│   ├── common/                 # Shared element types
│   ├── components.ts           # Element type → React component registry
│   ├── uml-elements.ts         # Element type → model class registry
│   ├── compose-preview.ts      # Element type → palette preview registry
│   ├── popups.ts               # Element type → property popup registry
│   └── diagram-type.ts         # Supported diagram types enum
├── services/                   # Domain logic (CRUD, undo, layout, collaboration)
├── components/                 # Canvas, sidebar, event listeners
└── i18n/                       # Translations (en, de, etc.)
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

### Path Aliases (webapp2)
Configured in `tsconfig.json` and `vite.config.ts`:
- `@/` → `src/`
- `@besser/wme` → `../editor/src/main/index.ts` (local dev, npm in production)
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
- `besser_systemConfig` - global agent system configuration (platform, IC technology, default LLM provider/model)
- `besser_activeAgentConfiguration` - id of the currently active stored agent configuration
- `besser_agentBaseModels` - per-AgentDiagram base (pre-personalization) UML model snapshots, keyed by diagram id
- `besser_deploy_linked_<projectId>_<target>` - per-project, per-target ({owner, repo}) of the last successful Render deploy
- `besser-standalone-settings` - application display settings (managed by `settingsService`), including `classNotation: 'UML' | 'ER'` which selects the class-diagram rendering flavor (pure rendering — no metamodel change)

### Global Display Settings (settingsService)
`packages/editor/src/main/services/settings/settings-service.ts` holds display preferences in localStorage under `besser-standalone-settings`. Rendering components read these **synchronously at render time** (e.g. `settingsService.shouldShowAssociationNames()`), they don't subscribe. For a toggle to actually repaint the canvas live, extend the existing `settingsService.onSettingsChange` listener in `packages/editor/src/main/scenes/application.tsx` and mirror the new field into component state — the `setState` call is what forces the subtree to re-render. Rendering components keep reading from `settingsService` directly (no props drilling needed). Don't bump `editorRevision` for view-only toggles — that clears undo history.

### Custom SVG Rendering
The editor uses custom SVG elements, **not** React-Flow or Apollon Canvas. Theme-aware wrappers live in `packages/editor/src/main/components/theme/themedComponents` (`ThemedRect`, `ThemedPath`, `ThemedPolyline`) — they pull fill/stroke from styled-components theme. Raw SVG primitives (`<polygon>`, `<rect>`, `<ellipse>`) **bypass the theme**, so always provide a fallback when using them with an optional `element.strokeColor`/`element.fillColor`:
```tsx
stroke={element.strokeColor || 'currentColor'}
fill={element.fillColor || 'white'}
```
The `Text` component at `packages/editor/src/main/components/controls/text/text.tsx` forwards unknown props to the underlying `<text>`, so SVG presentation attributes like `textDecoration="underline"` work directly.

## Adding a New Diagram Element

To add a new element type to the editor, register it in 4 files inside `packages/editor/src/main/packages/`:

1. **`components.ts`** - Map `UMLElementType.YourElement` → React render component
2. **`uml-elements.ts`** - Map `UMLElementType.YourElement` → model class
3. **`compose-preview.ts`** - Map to palette preview (what appears in sidebar)
4. **`popups.ts`** - Map to property popup component (edit panel)

Then create the element implementation in the appropriate diagram package directory (e.g., `packages/uml-class-diagram/your-element/`), containing:
- Model class (extends `UMLElement` or `UMLRelationship`)
- React component
- Update function (for property changes)

## Adding a New Diagram Type

1. Add entry to `diagram-type.ts` (`UMLDiagramType` object)
2. Create package directory under `packages/editor/src/main/packages/`
3. Register all elements in the 4 registry files
4. Add editor support in `packages/webapp2/src/main/features/editors/`
5. Add diagram type to backend's supported types if it needs generation/validation

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
- **E2E tests**: Playwright. Run from `packages/webapp2` (not the monorepo root) with `npm run test:e2e`
- **Linting**: ESLint (permissive — `any` and `ts-ignore` are warnings, not errors)
- **Formatting**: Prettier (check with `npm run prettier:check`)

## Important Conventions

### Code Style
- TypeScript strict mode
- Tailwind for styling (no inline styles or CSS modules in webapp2)
- Radix UI for accessible primitives (Dialog, DropdownMenu, Tooltip, etc.)
- ESLint warnings are acceptable but errors must be fixed
- `_` prefix for intentionally unused variables

### Editor Engine
- The editor (`@besser/wme`) is designed as a standalone library — webapp2 is one consumer
- Editor uses Redux internally (separate from webapp2's Redux store)
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

1. **webapp vs webapp2**: Always work in `webapp2`. The `webapp` package is legacy and should not be modified
2. **Feature cross-imports**: Never import from one feature into another. Move shared code to `shared/`
3. **Editor reinit**: Changing `editorRevision` in Redux causes a full editor remount. Only bump it for structural changes (switching diagram types, not for model updates)
4. **Storage sync loops**: When writing to `ProjectStorageRepository` from a thunk, use `withoutNotify()` to prevent the storage listener from re-dispatching
5. **Path aliases**: If adding new aliases, update both `tsconfig.json` and `vite.config.ts`
6. **Backend contract changes**: If you change backend API endpoints or request/response shapes, update the corresponding API calls in `shared/api/` and any Pydantic models in the backend
