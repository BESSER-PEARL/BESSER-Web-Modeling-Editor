# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Overview

BESSER Web Modeling Editor (WME) is the frontend of the BESSER low-code platform: a browser-based editor for
UML-family diagrams, GUI designs, agent models, quantum circuits and more, plus an **AI assistant** that builds
and edits models from natural language and a **Spec-Driven Agent** that turns a project into an application.
It talks to the BESSER Python/FastAPI backend for generation, validation, GitHub OAuth and deployment.

- Live: https://editor.besser-pearl.org
- Backend: https://github.com/BESSER-PEARL/BESSER — this repo is vendored there as a git submodule at
  `besser/utilities/web_modeling_editor/frontend`
- Modeling agent (the assistant's WebSocket backend): https://github.com/BESSER-PEARL/modeling-agent
- Long-form docs: `docs/source/` (`contributing/codebase-guide.rst` for the package tour)
- Diagram wire format (v4, React Flow `{nodes, edges}`): BESSER `docs/source/migrations/uml-v4-shape.md` — the
  contract shared by `packages/library`, the webapp and the backend converters

## Monorepo

npm workspaces (root `package.json`): `packages/server`, `packages/webapp`, `packages/library`.

| Package | npm name | Purpose |
|---------|----------|---------|
| `packages/webapp` | `webapp` | Main React SPA (Vite + React 18 + Tailwind + Radix UI) |
| `packages/library` | `@besser/wme` | Core diagramming engine (React Flow + Zustand), also published to npm |
| `packages/server` | `server` | Express server: serves the built webapp + two small endpoints |
| `packages/i18n` | — | Translation bundles. **Not a workspace**; imported by relative path |

> `--workspace=library` does NOT resolve (the package is named `@besser/wme`). Use `--workspace=@besser/wme`.

## Essential Commands

Node >= 20. Run from the monorepo root.

```bash
npm install
npm run dev                 # Vite dev server on http://localhost:8080; needs the backend on :9000
npm run dev:editor          # the library package's own Vite dev server

npm run build               # webapp + server into build/
npm run build:webapp        # webapp only
npm run build:local         # build with localhost backend URLs
npm run start:server        # Express on :8080, after building

# There is no `test` script at the root
npm run test --workspace=webapp            # Vitest unit tests (also test:watch, test:coverage)
npm run test --workspace=@besser/wme       # Vitest unit tests for the library
npm run test --workspace=server            # Vitest: the security headers
npm run test:e2e --workspace=webapp        # Playwright, tests in packages/webapp/tests/e2e/ (also test:e2e:ui)
npx tsc -p packages/library --noEmit       # library typecheck
npx tsc -p packages/webapp --noEmit        # webapp typecheck

npm run lint                               # ESLint for webapp + server; NOT the library package
npm run lint --workspace=@besser/wme       # library package
npm run prettier:check                     # / prettier:write
npm run i18n:check                         # translation coverage (warnings only)
npm run i18n:validate                      # strict translation check
```

**CI** (`.github/workflows/`) runs only the i18n checks. Lint, tests and build are not gated by CI — neither
here nor in the parent BESSER repo, whose `ci.yml` does not build the frontend. Run them locally.

## Where Things Live

Stack: Vite 7 (webapp, library) / Webpack (server), React 18.2, TypeScript 5.6 strict, Redux Toolkit (webapp),
React Flow (`@xyflow/react`) + Zustand + Yjs (library), Radix UI + Tailwind, react-i18next.

Webapp (`packages/webapp/src/main/`):

| Path | What |
|------|------|
| `app/application.tsx` | Root: routes (`/`, `/agent-config`, `/project-settings`, `*`), providers, lazy dialogs/widgets |
| `app/shell/` | `WorkspaceShell`, top bar, sidebar, `workspace-navigation.tsx`, `menus/` (incl. `generator-menu-config.ts`) |
| `app/store/` | `store.ts`, `workspaceSlice.ts`, `errorManagementSlice.ts`, typed hooks in `hooks.ts` |
| `app/hooks/` | `useProject`, `useProjectBootstrap`, `useStorageSync` |
| `features/editors/` | `EditorView.tsx` (dispatch: GUI → GrapesJS, quantum → custom, Knowledge Graph → Cytoscape, rest → BesserEditor), `uml/`, `gui/`, `quantum/`, `kg/`, `diagram-tabs/` |
| `features/assistant/` | AI assistant: WebSocket client, `services/converters/`, `services/modifiers/`, `services/shared/v4Builders.ts` |
| `features/inter-diagram/` | Derivations BPMN → Component → Deployment and agentic lane → Agent diagram (v4-native), the agent-diagram linker and element picker the editor calls back into, derivation warnings |
| `features/spec-driven/` | Spec-Driven Agent: SSE client, trigger hook, `state/specDrivenSlice.ts` |
| `features/{generation,deploy,github,import,export,project,agent-config,agent-components,agent-simulation,kg-settings}/` | One feature module each |
| `features/knowledge-graph/` | KG workflow: `refine/` (Refine dialog, preflight, AI suggestions), `convert/` (KG → class diagram, consistency gate), `useKgFlows` (OWL import stays in `import/`) |
| `shared/api/` | Every HTTP call: `api-client.ts` (singleton, 30 s default timeout, `ApiError`) and one module per backend area (`generation`, `conversion`, `validation`, `feedback`, `telemetry`, `specDriven`, `github`, `knowledgeGraph`, `agentSimulation`, `apiInfo`, `rateLimit`, `sseClient`); `generated/besser-openapi.d.ts` holds the backend's OpenAPI types |
| `shared/api/knowledgeGraph.ts` | Every Knowledge Graph endpoint, typed against the backend's response models; the LLM key goes only in the JSON body |
| `shared/kg/` | Knowledge Graph code several features use (constraint catalog, node priority, focus registry) |
| `shared/api/sseClient.ts` | Streaming client used by the spec-driven SSE path (bypasses `api-client`) |
| `shared/constants/constant.ts` | Env vars, endpoint builders, every storage key |
| `shared/services/storage/` | The only code that touches Web Storage: projects, GitHub, assistant, preferences, tab values, migrations; `migrate-uml-v3-to-v4.ts` lifts stored v3 diagram models to v4 on load and on import |
| `shared/types/project.ts` | `SupportedDiagramType`, `ALL_DIAGRAM_TYPES`, `BesserProject`, `PROJECT_SCHEMA_VERSION`, `ensureProjectMigrated` |
| `shared/utils/lineageHash.ts` | Source-model hash on `derivedFrom`; a mismatch shows the "source changed" banner |
| `shared/components/byok/LlmKeyDialog.tsx`, `shared/services/llmKeyStorage.ts` | The one BYOK dialog and key store; its providers and models come from the backend's model catalog (`/spec-driven/config` → `providers`) |

Library (`packages/library/lib/`):

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
│   ├── bpmn/                   #   BPMN tasks, events, gateways, pools, lanes
│   ├── componentDiagram/       #   Components, subsystems, interfaces
│   ├── deploymentDiagram/      #   Nodes, components, artifacts, interfaces
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
│   ├── diagramStore.ts         #   Nodes / edges / selection / undo (Yjs-backed)
│   ├── metadataStore.ts        #   Diagram name, type, mode, view
│   ├── popoverStore.ts         #   Active popover / inspector state
│   └── context.tsx             #   React context providers + hooks
├── services/                   # Domain logic (NO UI)
│   ├── diagramBridge.ts        #   Cross-diagram data sharing
│   ├── settingsService.ts      #   Application display settings
│   ├── errors.ts               #   BesserError broadcast channel
│   └── userMetaModel/          #   User-Diagram reference metamodel
├── sync/                       # Yjs collaboration adapter (YjsSyncClass)
├── types/                      # DiagramType + per-node data shapes (types/nodes/NodeProps.ts)
├── utils/                      # Pure utilities: versionConverter.ts (v3 → v4 migrator), autoLayout.ts (ELK),
│                               #   helpers.ts, classifierMemberDisplay.ts, multiplicity.ts, typeNormalization.ts
├── hooks/                      # React hooks (useConnect, useEdges, …)
└── constants.ts                # Layout constants, palette sizes, grid snap
```

Translation strings for both packages live in `packages/i18n/<locale>/{editor,webapp}.json` (`en`, `lb`, `de`,
`fr`, `es`, `ca`), not inside the library. English is the source of truth and the runtime fallback.

## Assistant and Agentic Integration

First-class part of the app, with two independent backends.

**Modeling assistant — WebSocket to the modeling agent.**
- `features/assistant/services/AssistantClient.ts`, a module-level singleton (`getSharedAssistantClient`) so the
  floating bubble (`AssistantWidget.tsx`) and the bottom drawer (`AssistantWorkspaceDrawer.tsx`) share one socket
  and conversation. They coordinate via the `besser:assistant-drawer` CustomEvent and `sessionStorage`; the bubble
  is hidden on `NNDiagram` and `KnowledgeGraphDiagram` (`services/assistantSupport.ts`).
- URL is `UML_BOT_WS_URL` (default `ws://localhost:8765`). The socket carries a per-tab `session_id` and a
  `localStorage`-persisted `user_id` query param — BAF keys backend sessions on it; without it every reconnect
  wipes conversation memory.
- The project snapshot sent as context carries **v4** diagram models; the modeling agent normalizes them to its
  internal shape at its protocol boundary. Agent replies are format-agnostic specs that the converters turn into
  v4 nodes/edges (`services/shared/v4Builders.ts`).
- Incoming payloads are filtered by `KNOWN_ACTIONS`. `SIDE_EFFECT_ACTIONS` are honoured **only** as the whole
  structured reply, never scraped out of prose (prompt-injection guard; see
  `services/__tests__/AssistantClient.injection.test.ts`).
- Converters (agent JSON → editor model) and modifiers (incremental edits) cover 10 types: Class, Object,
  StateMachine, Agent, QuantumCircuit, GUINoCode, User, BPMN, Component, Deployment. **`NNDiagram` is deliberately
  absent**, and `KnowledgeGraphDiagram` is not supported (its model is not a UML model; injection refuses to write
  one). A new type needs a converter **and** a modifier — a converter without a modifier silently falls back to the
  ClassDiagram one.
- Assistant edges carry no route points (`points: []`); the editor routes them. Agentic BPMN keys are written only
  on elements the agent marks agentic, and a gateway `governanceDsl` that is a policy keyword (`consensus`,
  `majority`, …) is expanded with the library's `generateGovernanceDsl`.
- `services/undoStack.ts` keeps assistant edits reversible; `RateLimiterService.ts` throttles per tab.

**Spec-Driven Agent — HTTP + SSE to the BESSER backend.**
- Endpoints in `shared/constants/constant.ts`: `/spec-driven/generate` (SSE), `/config`, `/cancel/<runId>`,
  `/download/<runId>`, `/runs/<runId>/events?after=N`.
- `services/specDrivenSseClient.ts` owns the request shape and `AbortController`; `hooks/useSpecDrivenTrigger.ts`
  owns the run lifecycle; `state/specDrivenSlice.ts` owns the run card.
- Guards to preserve: one run at a time via an atomic Redux slot claim, no auto-download, a 60 s stream-stall
  watchdog, durable reattach after reload via a minimal `localStorage` pointer.
- The backend contract is BESSER's `backend/models/spec_driven.py` (request) and
  `services/spec_driven/sse_events.py` (stream).

**BYOK, shared by both.** One dialog, one store (paths above). The key lives **only** in `sessionStorage`, and
`llmKeyStorage` is the only code that reads, writes or clears it (`readLlmKey` / `writeLlmKey` / `clearLlmKey`,
which also removes the model and base URL). It also holds `LLM_PROVIDERS`, the one provider list: the app's own lists
(`KEY_PROVIDERS`, the dialog's options, `SpecDrivenProvider`) are derived from it by filtering. The lists of what
another service accepts a key for are explicit allowlists, never derived, so a new provider is not sent to a service
by default: `ASSISTANT_KEY_PROVIDERS` (the modeling agent's) and `KG_LLM_PROVIDERS` (the backend's `KGLLMProvider`),
each pinned to its counterpart by `llmProviderAllowlists.test.ts`.
`provider: 'free'` is the keyless server-hosted tier, **Spec-Driven Agent only** — not offered in the
assistant's dialog, and its opt-in flag is kept separate from the key so no placeholder can break the assistant.
`'sponsored'` is the server-paid demo tier, set only by a `?demo=` link; neither is ever a stored key's provider.
Every password field is `SecretInput` (`components/ui/secret-input.tsx`, enforced by ESLint): a controlled input copies
its value into the `value` attribute, where injected CSS can read a key as it is typed.

### Security rules (AI features)
- Never let an agent-controlled payload set a privilege flag. `useAssistantLogic` rebuilds the
  `trigger_smart_generator` payload field by field and drops `planApproved` / `skipDeterministicGenerator`; only
  UI paths set `planApproved`, so a crafted reply cannot start a paid run.
- Never widen `SIDE_EFFECT_ACTIONS` handling to prose-scraped JSON.
- Never write an API key outside `sessionStorage`, never into Redux, never log one.
- Never add an inline `<script>` to `index.html`. Any script on the page can read `sessionStorage`, so the
  Content-Security-Policy in `packages/server/src/main/security-headers.ts` allows none; a new external origin
  the app loads from must be added there, or the browser blocks it in production (`npm run dev` sends no CSP).
- Never hardcode server-owned limits (cost/runtime caps, free-model ids, download TTL). They come from
  `GET /spec-driven/config`, fetched once per page load by `shared/services/specDrivenConfig.ts`; a stale
  hardcoded copy silently becomes the binding limit. The Knowledge Graph LLM timeout and orphan batch size come
  from `GET /kg/config` (`getKgConfig` in `shared/api/knowledgeGraph.ts`), with no fallback.

## Key Patterns

### Feature isolation
Each feature in `src/main/features/` has an `index.ts` that is its public API: other features import it only
through that index, never its internals, and a feature never imports its own index. `shared/` must not import
from `app/` or `features/`; code several features need goes in `shared/`. That is why `llmKeyStorage` and
`specDrivenConfig` live in `shared/`. ESLint (`no-restricted-imports` in `packages/webapp/.eslintrc.js`)
enforces both as errors. Keep an index to what other features use, and keep lazily loaded modules out of it:
once eager code imports an index, everything it re-exports lands in the main chunk. The two deep imports that
stay for that reason carry an `eslint-disable` comment saying so.

### Redux
- Async thunks mutate state and persist to `ProjectStorageRepository`; use `withoutNotify()` when writing to
  storage from a thunk, or the storage listener re-dispatches in a loop
- Bumping `editorRevision` fully remounts the editor (and clears undo history). Bump it only for structural
  changes such as switching diagram type — never for model updates or view-only toggles
- Use `useAppDispatch()` / `useAppSelector()` from `app/store/hooks.ts`

### Path aliases (webapp)
Defined in `tsconfig.json`, `vite.config.ts` **and** `vitest.config.ts` — change all three:
`@/` → `src/` for webapp files but `lib/` for library files (a conditional resolver in `vite.config.ts` picks the
base from the importer, since the library uses `@/*` internally); `@besser/wme` → `../library/lib/index.tsx`
(local source in dev **and** production — the webapp has no npm dependency on the package); `shared` →
`../shared/src/index.ts` (legacy; `packages/shared` does not exist); `webapp/*` → `./*`. The server's
`webpack.config.js` needs the same `@besser/wme` and `@` aliases.

### API communication
Every HTTP call lives in `shared/api/`; ESLint (`no-restricted-syntax`) rejects `fetch`, `XMLHttpRequest` and
`sendBeacon` anywhere else in `src/` (including `src/components/`) except tests, and `no-restricted-imports` rejects
importing `apiClient` outside `shared/api/` (tests may stub it). Calls go through `api-client.ts` (`request`, `get`, `post`,
`upload`, `downloadBlob`, `getBlob`) with an explicit `timeout` wherever the 30 s default does not fit; a failure
rejects with an `ApiError` (`status`, a readable `message`, and `detail` when the server sent one) or, on time-out,
a `TimeoutError` `DOMException`, so callers never parse the error body. Raw `fetch` stays only where the client cannot
carry the call: the SSE streams and their events-page fallback (`sseClient`, `specDriven`), fire-and-forget
`keepalive`/`sendBeacon` calls (telemetry, run cancel), GitHub sign-in and star calls (they must not get the
client's timeout or 401 session event), raw.githubusercontent.com files, and the editor's own Node rate limiter (`rateLimit`). Backend URL is hardcoded to `http://localhost:9000/besser_api` in dev, `BACKEND_URL`
in production. Backend endpoint or shape changes must be mirrored in `shared/api/` and the spec-driven SSE client.

Contract types come from the backend's OpenAPI schema: `packages/webapp/openapi/besser-openapi.json` and the
generated `shared/api/generated/besser-openapi.d.ts` (`import type { components } from '.../generated/besser-openapi'`).
Regenerate both with `npm run api:generate --workspace=webapp` (needs Python with BESSER's dependencies; BESSER
is imported from `BESSER_ROOT`, else from the checkout this repo is a submodule of; the script stops when neither
has a `besser/` package). CI regenerates the `.d.ts` from the committed JSON and fails on a difference. Type a
response body as the generated `components['schemas']['SchemaName']`: BESSER's response models state the real
contract (fields they always send are required, closed value sets are `Literal`s, fixed shapes are models), so fix
a loose type in the backend model, not in the editor. Only a free `dict` that holds an editor model is narrowed,
as `Omit<components['schemas']['X'], 'model'> & { model: ... }` (`KgRefinementResponse`, `KgDiagramResponse`).
Project payloads (`ProjectInput`) stay `unknown` in `generation`/`conversion`: the editor builds them as
a plain record (`buildProjectPayloadForBackend`); diagram payloads are typed `DiagramInput`.

### Error reporting
A failure the user should see goes through `reportError(message, { error, ...toastOptions })` in
`shared/services/errors/reportError.ts`: the react-toastify error toast (same options and `toastId` dedupe; with
`updateToast: id` it turns that toast, e.g. a `toast.loading`, into the error toast), plus the caught `error` to Sentry. Sentry loads only when `SENTRY_DSN` is set **and** the user accepted analytics in the
cookie banner (`applyAnalyticsConsent` in `lazy-analytics.ts` starts and stops it, like PostHog's opt-in); offline,
aborted and 4xx failures (`isNetworkError`, `ApiError`/`SseHttpError` status < 500) are toast-only, and the
`beforeSend` scrub (`scrubSentryEvent.ts`) keeps only the error type, HTTP status, stack, page path, browser,
breadcrumb categories and the SDK's own contexts (`trace`, `react`, device description): no message, other context, backend `detail`, query string (stack frame URLs included), extra data or user
(`ip_address: null` stops Sentry inferring the IP), as the privacy policy promises. Captures are
tagged `handled: reportError`. Google Analytics (`GA_MEASUREMENT_ID` in `constant.ts`) follows the same consent: gtag.js
is injected by `lazy-analytics.ts` after Accept and disabled with Google's `ga-disable-<id>` flag on withdrawal, so
never add a tracking tag to `index.html`; every provider is named in the cookie banner and privacy policy. Pass the message already translated; pass
`error` only for a caught exception, not for an expected case such as "open a project first". `notifyError(context)`
in the same module is the `.catch()` handler for fire-and-forget promises. Developer diagnostics stay `console.*`
at the call site; `reportError` never logs. Notices that used `alert()` use `globalAlert()` from
`shared/services/confirm/globalConfirm.ts` (the confirm dialog with one OK button; it does not block, so await it if
code must wait). ESLint (`no-restricted-syntax`) rejects `toast.error(`, `toast.update(id, { type: 'error' })` and `alert(` anywhere in `src/` outside those modules and tests,
and `no-restricted-globals` rejects the un-imported global `reportError` (the browser's own, which only fires an
`error` event).
Redux error state that drives a panel (`errorManagementSlice`, the agent simulation's error) is domain state and
stays in Redux.

### Product analytics (PostHog)
Every event goes through `track(event, properties)` in `shared/services/analytics/events.ts`, whose
`AnalyticsEvents` interface is the catalog: a new event or property is added there first, and TypeScript rejects
an undeclared event or property (a few properties, such as `editor_action.action`, are still plain strings). Properties are content-free by contract (enums, counts, booleans, durations, HTTP status, error class
name via `errorProperties(error)` / `trackFailure`): never a name, title, prompt, message, URL, repository or key.
Track both sides of an action: the success event only after it really succeeded, and a failure event at every
failure exit (`reportError` already sends a generic `error_shown`). PostHog is initialised in `lazy-analytics.ts`
(no React provider: swapping one in late remounted the whole app); events tracked before it loads are queued with
their timestamp. Without consent the page makes no request to PostHog at all: no remote config call, and the
heatmap and web-vitals scripts load only on a page that loads with consent (`lazy-analytics.posthog.test.ts`
checks this against the real posthog-js). URL properties lose their query and fragment
(`sanitizePostHogProperties`). A Spec-Driven run whose stream stalled is counted as failed (stage `stall`); if a
reload later reattaches to it, its outcome is sent again with `reattached: true`, so exclude reattached runs when
counting runs. Collecting a new kind of data means updating the privacy copy
(`shared.cookie.privacy` in every locale) too.

### Browser storage
Web Storage is read and written only by the typed modules in `shared/services/storage/`
(`ProjectStorageRepository`, `LocalStorageRepository`, `projectGitHubLink`, `specDrivenRunRecords`,
`githubStorage`, `assistantStorage`, `preferencesStorage`, `tabStorage`, the migration runner), plus
`llmKeyStorage` and `features/spec-driven/storage.ts` (`STORAGE_MODULES` in `packages/webapp/.eslintrc.js`).
Components, hooks and services call those; ESLint (`no-restricted-globals`, plus a `no-restricted-syntax` member
selector that also catches `window.localStorage`, casts, aliases and `document.defaultView`) rejects
`localStorage` / `sessionStorage` anywhere else in `src/` outside tests. Every key is a constant in
`shared/constants/constant.ts`; most are prefixed `besser_`, a few legacy ones (`github_session`,
`umlAgentRateLimiterState`, ...) keep their old spelling so users keep their data. **Secrets and
tab-scoped state go in `sessionStorage`, never `localStorage`**: the unified BYOK key
(`besser_llm_api_key` / `_provider` / `_model` / `_base_url`), free-tier opt-in, run budget, the GitHub
session id, and assistant UI state. `localStorage` holds projects (`besser_projects`, `besser_latest_project`,
`besser_project_<id>`), preferences, `besser_assistant_user_id`, agent configs, and the spec-driven crash-recovery
pointer (no key, prompt or content). Agent runtime config lives on `AgentDiagram.config`, not in a top-level key
(the v3 storage migration deletes the old `besser_systemConfig`). Stored v3 diagram models are lifted to v4 on
read. Project storage format: `docs/source/webapp/local-projects.rst`.

### Display settings (settingsService)
`packages/library/lib/services/settingsService.ts` stores display preferences under `besser-standalone-settings`
(incl. `classNotation: 'UML' | 'ER'`, rendering only). Components read it **synchronously at render time** (e.g.
`settingsService.shouldShowAssociationNames()`) and don't subscribe. For a toggle to repaint live, mirror the
field into Zustand state via `settingsService.onSettingsChange` — that `setState` is what re-renders the subtree.
Don't bump `editorRevision` for view-only toggles.

### Node and edge rendering
Every node has a React Flow component under `packages/library/lib/nodes/<diagramType>/` and every edge a renderer
under `packages/library/lib/edges/edgeTypes/`. Node components draw plain SVG inside a `<DefaultNodeWrapper>`
(which owns the selection / drag handles). Theme-aware colours flow through CSS variables (`--besser-background`,
`--besser-primary-contrast`, `--besser-gray`, …); raw SVG primitives bypass the theme, so give optional colours a
fallback: `stroke={data.strokeColor || 'var(--besser-primary-contrast, #000)'}`, `fill={data.fillColor || 'white'}`.

## Adding a Diagram Element
Create the node component under `packages/library/lib/nodes/<diagramType>/<YourNode>.tsx` and register it in that
folder's `index.ts`. Then:
1. Add the data shape to `packages/library/lib/types/nodes/NodeProps.ts` (`YourNodeProps` extending `DefaultNodeProps`)
2. Add an inspector panel in `packages/library/lib/components/inspectors/<diagramType>/<YourNode>EditPanel.tsx` and
   register it in the inspector `index.ts`
3. Add a palette preview in `packages/library/lib/components/svgs/nodes/<diagramType>/<YourDiagram>SVGs.tsx`
4. Route the popover in `packages/library/lib/components/popovers/PopoverManager.tsx`
5. Document the `node.data` fields in BESSER's `docs/source/migrations/uml-v4-shape.md` and teach the backend
   converters (`json_to_buml` / `buml_to_json`) to read and emit them

For a new edge, mirror the steps under `packages/library/lib/edges/edgeTypes/` and
`components/inspectors/<diagramType>/<YourEdge>EditPanel.tsx`.

## Adding a Diagram Type
1. Add it to `packages/library/lib/types/DiagramType.ts` (`UMLDiagramType`); create `nodes/<yourDiagram>/`, edges,
   inspectors and palette previews as above
2. Add it to `SupportedDiagramType`, `ALL_DIAGRAM_TYPES` and `BesserProject.diagrams` in `shared/types/project.ts`,
   and bump `PROJECT_SCHEMA_VERSION` with a migration
3. Sidebar/nav in `app/shell/workspace-navigation.tsx`; an editor branch in `features/editors/EditorView.tsx` if it
   needs a non-UML canvas
4. Generate-menu entries in `app/shell/menus/generator-menu-config.ts`
5. Assistant support: a converter **and** a modifier under `features/assistant/services/`
6. A `case` in `packages/library/lib/utils/versionConverter.ts` if legacy v3 fixtures need to be lifted to v4
7. Backend support if it needs generation/validation

Walkthrough: `docs/source/contributing/new-diagram-guide/`.

## Diagram Types
- **Project types (12)**, max 5 of each per project: `ClassDiagram`, `ObjectDiagram`, `StateMachineDiagram`,
  `AgentDiagram`, `UserDiagram`, `GUINoCodeDiagram`, `QuantumCircuitDiagram`, `NNDiagram`, `BPMN`,
  `ComponentDiagram`, `DeploymentDiagram`, `KnowledgeGraphDiagram` (`BPMN` maps to the wire value `'BPMNDiagram'`).
- The agentic perspective (BPMN, Agent, Component, Deployment all visible) turns on the editor's agentic BPMN
  controls (`agenticEnabled`); `shared/perspectives.ts`.
- Project schema: `PROJECT_SCHEMA_VERSION` is 7. 5 lifted stored v3 models to v4 (`migrateProjectToV5`, which also
  restamps lineage hashes); 6 made Component and Deployment project types; 7 made Knowledge Graph a project type
  (the KG build stamped that step 6, so it runs on every project below 7). Imports are migrated before they are
  stored.
- The library also carries Activity, UseCase, Communication, PetriNet, ReachabilityGraph, SyntaxTree and Flowchart
  types; these are **not** reachable from the webapp UI.
- `GUINoCodeDiagram` (GrapesJS), `QuantumCircuitDiagram` (custom canvas) and `KnowledgeGraphDiagram` (Cytoscape)
  keep their own formats; they are not v4 UML models and the v3→v4 migrators skip them by diagram type
  (`hasCustomEditor`). A KG model's `nodes`/`edges` look like v4 ones, so `isUMLModel` and `isKnowledgeGraphData`
  tell them apart by `type`. KG has no UML form, so SVG/PNG/UML-JSON exports do not apply to it (see below).

## Environment Variables
All configuration is **build time** — no runtime config endpoint. `vite.config.ts` passes exactly seven names to
`define` (`BACKEND_URL`, `DEPLOYMENT_URL`, `UML_BOT_WS_URL`, `POSTHOG_HOST`, `POSTHOG_KEY`, `SENTRY_DSN`,
`APPLICATION_SERVER_VERSION`), plus `EDITOR_VERSION`, which is not an env var but the webapp `package.json`
version (stamped into JSON exports); `shared/constants/constant.ts` is the only reader. For local dev none are needed.
Full reference: `docs/source/reference/environment.rst`.
- **`define` is a text substitution**: `process.env[name]` is never replaced. A new variable needs a static name
  added to both `vite.config.ts` and `constant.ts`.
- **`GITHUB_CLIENT_ID` does nothing here** (declared in the Dockerfile, read by nothing). GitHub OAuth runs in the
  BESSER backend (`services/deployment/github_oauth.py`); set the OAuth variables there.
- `packages/server` reads only `DEPLOYMENT_URL` and `SENTRY_DSN` at runtime; its port is hardcoded to 8080. Its
  webpack bundle bakes in `BACKEND_URL`, `UML_BOT_WS_URL` and `POSTHOG_HOST` for the Content-Security-Policy
  (from the environment, then `packages/webapp/.env`), so it allows what the webapp was built with.

## Testing and Style
- Unit tests: Vitest + jsdom in both `packages/webapp` (`vitest.config.ts`, setup `src/test/setup.ts`, pattern
  `src/**/*.{test,spec}.{ts,tsx}`, in `__tests__/` folders next to the code) and `packages/library`
  (`vitest.config.ts`). Webapp tests that import the library need the `canvas.getContext` mock in the webapp
  setup (the library measures SVG text at module-eval time). If invoking Playwright directly (not via the
  workspace script), do it from `packages/webapp`, where its config lives.
- ESLint per package is permissive: `any` and `ts-ignore` are warnings. Warnings are acceptable, errors must be
  fixed. `_` prefix for intentionally unused variables.
- Tailwind for webapp styling (no inline styles or CSS modules); Radix UI for accessible primitives.
- User-facing strings go through `react-i18next`; `packages/i18n/en/webapp.json` is the source of truth.
- GUI editor: GrapesJS loaded dynamically, component registrars in `features/editors/gui/component-registrars/`,
  charts via Recharts. Quantum editor: custom canvas with react-dnd, gates in `features/editors/quantum/gates/`.
- Knowledge Graph editor (`features/editors/kg/`): Cytoscape.js canvas (+ edgehandles, fcose), inspector,
  constraint editors. Rules worth knowing before changing it:
  - a node has two labels in Cytoscape: `label` (stored, round-trips) and `displayLabel` (drawn, never written
    back); `canvasModel.ts` holds the pure model <-> canvas translation and its tests
  - which nodes are visible is React state saved into `settings.visibleIds`; compare models with
    `sameKgContent` (ignores it) or an echo of the editor's own save resets the selection
  - Space/Delete only act while the canvas has focus (`canvasKeys.ts`); undo/redo is `shared/hooks/useUndoRedo`
  - the stylesheet follows the page theme (`buildKgStylesheet(dark)`); the standalone HTML export always uses
    the light one, and its CDN scripts are pinned with integrity hashes that a test checks against the installed
    packages — after upgrading cytoscape/fcose, update `CDN_SCRIPTS`
  - backend calls go through `shared/api/knowledgeGraph.ts`; the AI tabs use the shared LLM key
    (`llmKeyStorage`) and send it with its provider (Anthropic, OpenAI, Mistral or Nebius; PIA and local keys
    are refused); the convert/refine dialogs are
    driven by `features/knowledge-graph/useKgFlows.ts`, RDF export is a section of the Export dialog
  - the modeling assistant does not support KG: no converter/modifier, the bubble is hidden on it and an
    injection targeting it is refused

## Cross-Repo Workflow
1. Commit and push frontend changes on a branch here
2. Make the backend changes in BESSER
3. In BESSER, move the pointer (`cd besser/utilities/web_modeling_editor/frontend && git checkout <branch>`) and
   stage it (`git add besser/utilities/web_modeling_editor/frontend`)
4. Link both PRs and note the merge order

`M besser/utilities/web_modeling_editor/frontend` in the parent's `git status` means the pointer moved.

## Known Rough Edges
Documented so they are not rediscovered as bugs:
- Root `package.json` `name`/`repository` still reference the old `BESSER/BESSER_WME_standalone`; the real remote
  is `BESSER-PEARL/BESSER-Web-Modeling-Editor`.
- `entrypoint.sh` is stale (`/var/besser/build/server`, `server.js`); the Dockerfile uses
  `/opt/besser/build/server` and `bundle.js` and does not invoke it.
- `create_diagram_tab` is in `KNOWN_ACTIONS` but missing from the `AssistantActionName` union in
  `features/assistant/services/assistant-types.ts`.
- `selectProjectFile()` advertises `.zip`, but `importProject()` has no zip branch.
- `DIAGRAM_GENERATOR_MAP` in `workspace-navigation.tsx` is out of sync with `generator-menu-config.ts`, which is
  the source of truth for what users see.
