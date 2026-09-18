# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Overview

BESSER Web Modeling Editor (WME) is the frontend for the BESSER low-code platform. It provides a browser-based visual editor for creating UML diagrams, GUI designs, agent models, quantum circuits, and more, plus an **AI assistant** that builds and edits those models from natural language and a **Spec-Driven Agent** that turns a project into a whole application. The editor communicates with a Python/FastAPI backend for code generation, validation, GitHub OAuth, and deployment.

- **Live**: https://editor.besser-pearl.org
- **Backend repo**: https://github.com/BESSER-PEARL/BESSER
- **Modeling agent** (the assistant's WebSocket backend): https://github.com/BESSER-PEARL/modeling-agent
- **This repo is vendored** into the backend as a git submodule at `besser/utilities/web_modeling_editor/frontend`

## Monorepo Structure

npm workspaces: `packages/server`, `packages/webapp`, `packages/editor` (declared in the root `package.json`).

| Package | npm name | Purpose |
|---------|----------|---------|
| `packages/webapp` | `webapp` | Main React SPA (Vite + React 18 + Tailwind + Radix UI) |
| `packages/editor` | `@besser/wme` | Core diagramming engine |
| `packages/server` | `server` | Express server: serves the built webapp + two small endpoints |
| `packages/i18n` | — | Translation bundles. **Not a workspace**; imported by relative path |

Almost all feature work happens in `webapp` and `editor`.

> `--workspace=editor` does NOT resolve (the package is named `@besser/wme`). Use `--workspace=@besser/wme`.
>
> `packages/webapp2/` is an untracked leftover directory containing only `node_modules`. Ignore it.

## Essential Commands

```bash
# Install all dependencies (run from monorepo root)
npm install

# Development (starts Vite dev server on http://localhost:8080)
# Requires BESSER backend running at http://localhost:9000
npm run dev
npm run dev:editor         # editor package's own webpack dev server

# Build for production
npm run build              # Builds webapp + server into build/
npm run build:webapp       # webapp only
npm run build:local        # Build with localhost backend URLs

# Testing — NOTE: there is no `test` script at the root
npm run test --workspace=webapp            # Vitest unit tests
npm run test:watch --workspace=webapp
npm run test:coverage --workspace=webapp
npm run test:e2e --workspace=webapp        # Playwright E2E
npm run test:e2e:ui --workspace=webapp

# Linting & formatting (root)
npm run lint               # ESLint (webapp + server; NOT the editor package)
npm run lint --workspace=@besser/wme       # editor package
npm run prettier:check     # Check formatting
npm run prettier:write     # Auto-format
npm run i18n:check         # Translation coverage (warnings only)
npm run i18n:validate      # Strict translation check

# Standalone server (after building)
npm run start:server       # Express on http://localhost:8080
```

**Node requirement**: >= 20.0.0

**CI** (`.github/workflows/`) only runs the i18n checks. Lint, tests and build are not gated in this repo's CI — the parent BESSER repo's `ci.yml` runs frontend lint+build.

## Architecture Overview

### Tech Stack
- **Build**: Vite 7 (webapp), Webpack (server, editor)
- **Framework**: React 18.2 + React Router 6
- **State**: Redux Toolkit — `workspaceSlice`, `errorManagementSlice`, `specDrivenSlice`
- **UI**: Radix UI primitives + Tailwind CSS (class-based dark mode)
- **Editors**: ApollonEditor (all UML-family diagrams), GrapesJS (GUI no-code), custom (quantum circuits)
- **i18n**: react-i18next, 6 locales, English is the fallback
- **Testing**: Vitest + jsdom (unit), Playwright (E2E)
- **TypeScript**: 5.6, strict mode, ES2021 target

### Source Layout (webapp)

```
packages/webapp/src/main/
├── app/                        # Shell, routing, Redux store
│   ├── application.tsx         # Root: routes, providers, lazy dialogs/widgets
│   ├── shell/                  # WorkspaceShell/TopBar/Sidebar, menus, LanguageSelector
│   ├── store/                  # store.ts, workspaceSlice.ts, errorManagementSlice.ts, hooks.ts
│   └── hooks/                  # useProject, useProjectBootstrap, useStorageSync
├── features/                   # Feature modules (isolated)
│   ├── editors/                # EditorView + uml/gui/quantum editors, diagram-tabs,
│   │                           #   user-profile-form
│   ├── generation/             # Classic generator dialogs & hooks
│   ├── deploy/                 # Render deployment
│   ├── github/                 # Sign-in, repo storage, commits, push, gists
│   ├── import/                 # Import hooks (file, BUML, image, KG, BPMN XML)
│   ├── export/                 # Export dialog + per-format hooks
│   ├── assistant/              # AI assistant: WebSocket client, converters, modifiers
│   ├── spec-driven/            # Spec-Driven Agent: SSE client, run state, storage
│   ├── agent-config/           # Agent configuration panels
│   └── project/                # Project hub, first-run landing, settings, templates
├── shared/                     # Cross-feature code
│   ├── api/api-client.ts       # Centralized HTTP client
│   ├── components/             # Reusable UI, incl. byok/LlmKeyDialog
│   ├── constants/              # Environment vars, storage keys, endpoint builders
│   ├── dialogs/                # About, Feedback, HelpGuide, KeyboardShortcuts
│   ├── hooks/                  # Shared React hooks
│   ├── i18n/                   # react-i18next init + language list
│   ├── perspectives.ts         # Diagram-visibility presets
│   ├── services/               # storage, validation, analytics, sse, telemetry,
│   │                           #   llmKeyStorage, specDrivenConfig, project-import
│   ├── types/                  # TypeScript types (BesserProject, etc.)
│   └── utils/                  # Pure utilities
└── templates/                  # Starter project templates
```

Routes (`app/application.tsx`): `/` → `EditorView`, `/agent-config`, `/project-settings`, `*` → `NotFound`.

### Editor Package (packages/editor)

The diagramming engine, `@besser/wme`.

```
packages/editor/src/main/
├── apollon-editor.ts           # Public API (ApollonEditor class)
├── index.ts                    # Entry point — re-exports the public surface
├── packages/                   # Diagram-specific implementations
│   ├── uml-class-diagram/      # Class diagram elements
│   ├── uml-object-diagram/     # Object diagram elements
│   ├── uml-state-diagram/      # State machine elements
│   ├── agent-state-diagram/    # Agent diagram elements
│   ├── user-modeling/          # User profile elements
│   ├── nn-diagram/             # Neural network elements
│   ├── bpmn/                   # BPMN elements
│   ├── flowchart/ syntax-tree/ uml-petri-net/ ... # Legacy/extra families
│   ├── common/                 # Shared element types
│   ├── components.ts           # Element type → React component registry
│   ├── uml-elements.ts         # Element type → model class registry
│   ├── compose-preview.ts      # Element type → palette preview registry
│   ├── popups.ts               # Element type → property popup registry
│   └── diagram-type.ts         # UMLDiagramType object
├── services/                   # Domain logic (CRUD, undo, layout, patcher, settings)
├── scenes/                     # Top-level React trees (application, svg export)
├── components/                 # Canvas, sidebar, event listeners, components/i18n
└── utils/
```

Translation **strings** for both packages live in `packages/i18n/<locale>/{editor,webapp}.json` — `en`, `lb`, `de`, `fr`, `es`, `ca`. There is no `src/main/i18n/` in the editor package.

### Assistant / agentic integration

This is a first-class part of the app, not an add-on. Two independent backends:

**1. The Modeling Assistant — WebSocket to the modeling agent.**

- Client: `features/assistant/services/AssistantClient.ts`. A module-level singleton (`getSharedAssistantClient`) so the bubble and the drawer share one socket and one conversation.
- URL: `UML_BOT_WS_URL` from `shared/constants/constant.ts`, passed in at `features/assistant/hooks/useAssistantLogic.ts`. The class itself defaults to `ws://localhost:8765`.
- The socket carries a per-tab `session_id` and a `localStorage`-persisted `user_id` query param (BAF keys backend sessions on it; without it every reconnect wipes conversation memory).
- Two UI surfaces, both lazy: `AssistantWidget.tsx` (floating bubble, mounted in `app/application.tsx`) and `AssistantWorkspaceDrawer.tsx` (bottom sheet, mounted in `app/shell/WorkspaceShell.tsx`). They coordinate through the `besser:assistant-drawer` CustomEvent and `sessionStorage`. The bubble is hidden on `NNDiagram`.
- Incoming payloads are filtered by `KNOWN_ACTIONS`; `SIDE_EFFECT_ACTIONS` are honoured **only** as the whole structured reply, never scraped out of prose (prompt-injection guard — keep it that way, and see `services/__tests__/AssistantClient.injection.test.ts`).
- `services/converters/` (agent JSON → editor model) and `services/modifiers/` (incremental edits) each register 8 diagram types: Class, Object, StateMachine, Agent, QuantumCircuit, GUINoCode, User, BPMN. **`NNDiagram` is deliberately absent.** Adding assistant support for a diagram type means adding a converter AND a modifier.
- `services/undoStack.ts` keeps assistant edits reversible; `RateLimiterService.ts` throttles per tab by message tier.

**2. The Spec-Driven Agent — HTTP + SSE to the BESSER backend.**

- Endpoints are built in `shared/constants/constant.ts`: `/spec-driven/generate` (SSE), `/config`, `/cancel/<runId>`, `/download/<runId>`, `/runs/<runId>/events?after=N`. `SMART_GEN_PREVIEW_ENDPOINT` is declared but **has no callers**.
- `features/spec-driven/services/specDrivenSseClient.ts` owns the request shape and the `AbortController`; `hooks/useSpecDrivenTrigger.ts` owns the run lifecycle; `state/specDrivenSlice.ts` owns the run card.
- Guards worth preserving: `planApproved` must be set by a UI path (the agent can never inject it — `useAssistantLogic` rebuilds the payload field by field), one run at a time via an atomic Redux slot claim, no auto-download, a 60 s stream-stall watchdog, and durable reattach after a reload via a minimal `localStorage` pointer.
- Server config (free-tier models, cost/runtime caps, download TTL) is fetched once per page load by `shared/services/specDrivenConfig.ts`. **Never re-hardcode caps** — a stale hardcoded copy once became the binding limit and killed healthy runs.

**3. BYOK, shared by both.**

- One dialog: `shared/components/byok/LlmKeyDialog.tsx`. One store: `shared/services/llmKeyStorage.ts`.
- The key lives **only** in `sessionStorage`, never in `localStorage`, never in Redux, never logged.
- `features/assistant/services/byokStorage.ts` and `features/spec-driven/storage.ts` are thin readers over the same keys. (The doc comment in `byokStorage.ts` still claims the assistant keeps an independent key — that is stale; the constants are aliases.)
- `provider: 'free'` is the keyless server-hosted tier, **Spec-Driven Agent only** — it is not offered in the assistant's key dialog, and its opt-in flag is kept separate from the key so no placeholder value can break the assistant.

## Key Patterns

### Feature Isolation
Features in `src/main/features/` must NOT import from other features. Use `shared/` for cross-feature code. Each feature owns its own hooks, components, and dialogs. This is why `llmKeyStorage` and `specDrivenConfig` live in `shared/` even though only two features use them.

### Redux State Management
Project/diagram state lives in a single `workspaceSlice`; `errorManagementSlice` handles error boundaries; `specDrivenSlice` (owned by the spec-driven feature, mounted in `app/store/store.ts`) handles generation runs. Key patterns:
- Async thunks for state mutations (they also persist to `ProjectStorageRepository`)
- Use `withoutNotify()` when writing to storage from thunks (prevents infinite sync loops)
- `editorRevision` counter triggers editor reinitialization when bumped
- Typed hooks: `useAppDispatch()` and `useAppSelector()` from `store/hooks.ts`

### Path Aliases (webapp)
Configured in `tsconfig.json`, `vite.config.ts` **and** `vitest.config.ts` — update all three:
- `@/` → `src/`
- `@besser/wme` → `../editor/src/main/index.ts` (local source, in dev **and** in production builds — the webapp has no npm dependency on the package)
- `shared` → `../shared/src/index.ts` (legacy alias; `packages/shared` does not exist)
- `webapp/*` → `./*`

### API Communication
Most backend calls go through `shared/api/api-client.ts`:
- Singleton `apiClient`, 30 s default timeout, per-request `timeout` override
- Methods: `request()`, `get()`, `post()`, `upload()` (FormData), `downloadBlob()` (binary)
- Custom `ApiError` class with HTTP status
- Backend URL: `http://localhost:9000/besser_api` in dev (hardcoded), `BACKEND_URL` in production

Streaming (spec-driven SSE) bypasses it and uses `shared/services/sse/sseClient.ts`.

### Browser Storage Keys
All prefixed `besser_`. **Sensitive values go in `sessionStorage`, never `localStorage`.**

`localStorage`:
- `besser_projects` / `besser_latest_project` / `besser_project_<id>` - project storage
- `besser_diagrams` / `besser_latest` - legacy diagram storage
- `besser_userThemePreference` - dark/light mode
- `besser_language` - i18next language choice
- `besser_preferred_interface` - `'model'` or `'agent'`, set by the first-run landing
- `besser_assistant_user_id` - stable id keeping the agent's backend session across reconnects
- `besser_agentConfigs` / `besser_agentProfileMappings` / `besser_agentActiveConfig` / `besser_agentBaseModels` - agent state
- `besser_userProfiles` - saved per-user UML profile snapshots for agent personalization variants
- `besser_deploy_linked_<projectId>_<target>` - last successful deploy target
- `besser_github_linked_repos` / `besser_github_auto_commit` / `github_username`
- `besser_smartgen_lastrun_<projectId>` / `besser_smartgen_active:v2:<runId>` - spec-driven modify base and crash recovery pointer (no key, prompt, or content)
- `besser-standalone-settings` - editor display settings (managed by `settingsService`), including `classNotation: 'UML' | 'ER'` (pure rendering — no metamodel change)

`sessionStorage` (tab lifetime):
- `besser_llm_api_key` / `besser_llm_provider` / `besser_llm_model` / `besser_llm_base_url` - the unified BYOK key
- `besser_smart_gen_free_tier` / `besser_smart_gen_free_model` - keyless free-tier opt-in
- `besser_smart_gen_max_cost_usd` / `besser_smart_gen_max_runtime_seconds` - run budget
- `github_session` / `github_session_timestamp` - GitHub OAuth session id (24 h)
- `besser_open_assistant_on_load` / `besser_assistant_drawer_open` / `besser_assistant_handle_hinted` / `besser_pending_assistant_prompt` - assistant UI state
- `besser_continue_from_github_intent` / `besser_smart_gen_push_intent` - connect-first intents

> **Deprecated (v7.3.0):** `besser_systemConfig` was removed as a top-level localStorage key. Agent runtime config (platform, intent-recognition technology, LLM provider/model) now lives on the agent diagram itself (`AgentDiagram.config`) — single source of truth. The v3 storage migration deletes the legacy key on next launch.

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

1. Add entry to `diagram-type.ts` (`UMLDiagramType` object) in the editor package
2. Create the package directory under `packages/editor/src/main/packages/` and register all elements in the 4 registry files
3. Add the type to `SupportedDiagramType`, `ALL_DIAGRAM_TYPES` and `BesserProject.diagrams` in `packages/webapp/src/main/shared/types/project.ts`, and bump `PROJECT_SCHEMA_VERSION` with a migration
4. Add sidebar/nav entries in `app/shell/workspace-navigation.tsx`, and an editor branch in `features/editors/EditorView.tsx` if it needs a non-UML canvas
5. Add Generate-menu entries in `app/shell/menus/generator-menu-config.ts`
6. For assistant support, add a converter **and** a modifier under `features/assistant/services/`
7. Add the diagram type to the backend's supported types if it needs generation/validation

See `docs/source/contributing/new-diagram-guide/` for the long-form walkthrough.

## Diagram Types

**Project diagram types (9)** — `shared/types/project.ts`, max 5 diagrams of each per project:
`ClassDiagram`, `ObjectDiagram`, `StateMachineDiagram`, `AgentDiagram`, `UserDiagram`, `GUINoCodeDiagram`, `QuantumCircuitDiagram`, `NNDiagram`, `BPMN`.

**Editor engine types** — `packages/editor/.../diagram-type.ts` additionally carries `ActivityDiagram`, `UseCaseDiagram`, `CommunicationDiagram`, `ComponentDiagram`, `DeploymentDiagram`, `PetriNet`, `ReachabilityGraph`, `SyntaxTree`, `Flowchart`. These are **not** reachable from the webapp's project UI. Note `BPMN` maps to the wire value `'BPMNDiagram'`.

**Editor dispatch** — `features/editors/EditorView.tsx`: `GUINoCodeDiagram` → GrapesJS, `QuantumCircuitDiagram` → custom canvas, everything else → `ApollonEditorComponent`.

**Assistant support (8)** — everything except `NNDiagram`.

## Environment Variables

All configuration is **build time**. There is no `.env` in the repo and no runtime config endpoint. `vite.config.ts` reads them with `loadEnv(mode, cwd, '')` (no prefix filter) and passes exactly these seven to `define`; `shared/constants/constant.ts` is the only reader, falling back to `import.meta.env.VITE_<NAME>`.

| Variable | Dev Default | Purpose |
|----------|-------------|---------|
| `BACKEND_URL` | `http://localhost:9000/besser_api` (hardcoded in dev) | Python backend API |
| `DEPLOYMENT_URL` | - | Public origin; fallback for the assistant WebSocket URL |
| `UML_BOT_WS_URL` | `ws://localhost:8765` | Modeling agent WebSocket |
| `POSTHOG_HOST` / `POSTHOG_KEY` | - | Analytics (optional) |
| `SENTRY_DSN` | - | Error tracking (optional) |
| `APPLICATION_SERVER_VERSION` | - | Exported but read by no component |

For local development, only `BACKEND_URL` matters and it defaults correctly.

`packages/server` reads only `DEPLOYMENT_URL` and `SENTRY_DSN` at runtime; its port is hardcoded to 8080. The `APOLLON_REDIS_*` variables some older docs mention no longer do anything.

> **`GITHUB_CLIENT_ID` is dead here.** The Dockerfile declares it as an `ARG`/`ENV`, but it is not in the `define` block and nothing in `packages/webapp` or `packages/server` reads it. GitHub OAuth is performed entirely by the **BESSER Python backend** (`besser/utilities/web_modeling_editor/backend/services/deployment/github_oauth.py`): the webapp redirects to `<BACKEND_URL>/github/auth/login`, the backend exchanges the code with its own `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`/`GITHUB_REDIRECT_URI`, and redirects back to `<DEPLOYMENT_URL>?github_session=…&username=…`. The browser only ever holds the opaque session id. If you need to make OAuth work, set the variables on the backend.

## Cross-Repo Workflow (Frontend + Backend)

This repo is vendored into the BESSER backend as a git submodule. When making changes that span both repos:

1. Make frontend changes in this repo, push to a branch
2. Make backend changes in the BESSER repo
3. Update the submodule pointer in BESSER: `cd besser/utilities/web_modeling_editor/frontend && git checkout your-branch`
4. Stage the submodule change in BESSER: `git add besser/utilities/web_modeling_editor/frontend`
5. Link both PRs and note the merge order

When you see `M besser/utilities/web_modeling_editor/frontend` in the parent repo's git status, it means the submodule pointer has moved.

## Testing Approach

- **Unit tests**: Vitest with jsdom. Config in `packages/webapp/vitest.config.ts`, setup in `src/test/setup.ts`, pattern `src/**/*.{test,spec}.{ts,tsx}`. Tests sit next to the code in `__tests__/` folders.
- **E2E tests**: Playwright, `packages/webapp/tests/e2e/`. Run from `packages/webapp` (not the monorepo root).
- **`packages/editor` has no `test` script** despite Jest devDependencies and a `src/tests/unit/` tree — those tests are not runnable as configured. Editor changes are covered only through the webapp's tests.
- **Linting**: ESLint flat config per package (`packages/*/.eslintrc.js`), permissive — `any` and `ts-ignore` are warnings, not errors.
- **Formatting**: Prettier (check with `npm run prettier:check`).
- **i18n**: `npm run i18n:check` (coverage, warnings) and `npm run i18n:validate` (strict). The only checks CI enforces.

## Important Conventions

### Code Style
- TypeScript strict mode
- Tailwind for styling (no inline styles or CSS modules in webapp)
- Radix UI for accessible primitives (Dialog, DropdownMenu, Tooltip, etc.)
- ESLint warnings are acceptable but errors must be fixed
- `_` prefix for intentionally unused variables
- User-facing strings go through `react-i18next` (`packages/i18n/en/webapp.json` is the source of truth); English is also the runtime fallback for every other locale

### Editor Engine
- The editor (`@besser/wme`) is designed as a standalone library — webapp is one consumer
- Editor uses Redux internally (separate from webapp's Redux store)
- styled-components used inside editor package (legacy, not Tailwind)
- Custom Jinja-style delimiters (`[[` / `]]`) not applicable here — that's the backend React generator

### GUI Editor
- Uses GrapesJS (drag-and-drop page builder), loaded dynamically
- Custom component registrars in `features/editors/gui/component-registrars/`
- Chart widgets use Recharts library
- State synced to Redux via `useStorageSync()` hook

### Quantum Circuit Editor
- Fully custom canvas-based editor (react-dnd for drag/drop)
- Gate definitions in `features/editors/quantum/gates/`
- No circuit library dependency

### AI Features
- Never let an agent-controlled payload set a privilege flag. `planApproved` and `skipDeterministicGenerator` are rebuilt field-by-field on the UI side precisely so a crafted reply cannot start a paid run.
- Never widen `SIDE_EFFECT_ACTIONS` handling to prose-scraped JSON.
- Never write an API key outside `sessionStorage`, and never log one.
- Never hardcode server-owned limits (cost caps, runtime caps, free-model ids, download TTL) — read them from `GET /spec-driven/config`.

## Common Pitfalls

1. **Feature cross-imports**: Never import from one feature into another. Move shared code to `shared/`
2. **Editor reinit**: Changing `editorRevision` in Redux causes a full editor remount. Only bump it for structural changes (switching diagram types, not for model updates)
3. **Storage sync loops**: When writing to `ProjectStorageRepository` from a thunk, use `withoutNotify()` to prevent the storage listener from re-dispatching
4. **Path aliases**: If adding new aliases, update `tsconfig.json`, `vite.config.ts` **and** `vitest.config.ts`
5. **Vite `define` is a text substitution**: `process.env[name]` is never replaced. New env vars need a static name added to both `vite.config.ts` and `constant.ts`
6. **Backend contract changes**: If you change backend API endpoints or request/response shapes, update the corresponding calls in `shared/api/` (and the spec-driven SSE client) and any Pydantic models in the backend
7. **Assistant diagram support is two registrations**: a converter without a modifier silently falls back to the ClassDiagram implementation

## Known Rough Edges

Documented so they are not rediscovered as bugs:

- Root `package.json` `name`/`repository` point at an old remote (`BESSER/BESSER_WME_standalone`); the real remote is `BESSER-PEARL/BESSER-Web-Modeling-Editor`.
- `entrypoint.sh` is stale — it `cd`s to `/var/besser/build/server` and runs `server.js`, while the Dockerfile uses `/opt/besser/build/server` and `bundle.js`. The Dockerfile does not invoke it.
- `create_diagram_tab` is in `KNOWN_ACTIONS` but missing from the `AssistantActionName` union in `services/assistant-types.ts`.
- `SMART_GEN_PREVIEW_ENDPOINT` (`/spec-driven/preview`) has no callers — there is no plan-review step today.
- The Project Hub's `'describe'` step is fully built but unreachable: nothing calls `setStep('describe')`.
- `selectProjectFile()` advertises `.zip`, but `importProject()` has no zip branch.
- `DIAGRAM_GENERATOR_MAP` in `app/shell/workspace-navigation.tsx` is out of sync with `generator-menu-config.ts`, which is the source of truth for what users actually see.
- The doc comment in `features/assistant/services/byokStorage.ts` claims the assistant keeps a key separate from the Spec-Driven Agent's; they were unified and the constants are now aliases.
