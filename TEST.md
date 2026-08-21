# Testing the Web Modeling Editor

This document is the contributor-facing map of the WME test suite: what the two
test layers are, how to run each, and an inventory of every spec.

All tests live in the **`packages/webapp`** workspace. There are two layers:

| Layer | Tech | Location | What it proves |
|---|---|---|---|
| **Unit / component** | Vitest + jsdom | `packages/webapp/src/**/__tests__/*.{test,spec}.{ts,tsx}` (co-located with source) | Pure logic and React components in isolation — assistant routing, smart-gen SSE/Redux/dialogs, storage, converters/modifiers, GUI helpers, i18n. Everything network- or browser-adjacent is mocked. |
| **End-to-end (UI)** | Playwright (Chromium) | `packages/webapp/tests/e2e/*.spec.ts` | A real browser drives the app shell, project lifecycle, settings, theme, the deploy contract, and the assistant → generate flow. |

> **See also**
> - `packages/webapp/tests/e2e/README.md` — the narrative "test catalogue" for the
>   E2E + NL-generation surfaces. (That file predates `smart-gen-full-flow.spec.ts`
>   and the free-tier-default rewrite; **this document is the current inventory.**)
> - `BESSER/tests/SMART_GEN_TESTING.md` — the cross-repo Spec-Driven-Agent / free-tier
>   test suite and how to run each layer (bash + PowerShell).

There are **no** unit or E2E tests in `packages/editor` or `packages/server` today —
the whole suite is in `packages/webapp`.

---

## Running the tests

Everything runs from the `webapp` workspace. From the **repo root** prefix with
`--workspace=webapp`; from **`packages/webapp`** drop the prefix.

### Unit (Vitest)

```bash
npm run test          --workspace=webapp   # vitest run — one-shot (CI mode)
npm run test:watch    --workspace=webapp   # vitest — interactive watch
npm run test:coverage --workspace=webapp   # vitest run --coverage
```

### End-to-end (Playwright)

```bash
npm run test:e2e      --workspace=webapp   # headless (auto-starts Vite on :8080)
npm run test:e2e:ui   --workspace=webapp   # interactive Playwright UI

# a single spec / a live spec
npx playwright test smoke --project=chromium
RUN_LIVE_E2E=1 npx playwright test smart-gen-vibe-live --project=chromium
```

`playwright.config.ts` auto-starts the Vite dev server on `http://localhost:8080`
before the run (unless `LIVE_E2E_BASE_URL` is set, see below). A few flows also
expect the BESSER backend on `:9000`, but the mocked specs stub what they need.

### Environment knobs

| Env var | Effect |
|---|---|
| `PLAYWRIGHT_BASE_URL` | Base URL for the local/mocked specs (default `http://localhost:8080`). |
| `LIVE_E2E_BASE_URL` | Target URL for the **live** vibe spec (default `https://experimental.besser-pearl.org`). Setting it also tells `playwright.config.ts` **not** to start the local Vite server (you point at a deployment instead). |
| `RUN_LIVE_E2E=1` | Enables the gated live spec `smart-gen-vibe-live` (skipped otherwise). |
| `PW_WATCH=1` | "Watch mode": slow-mo (700 ms) + video capture so a human can follow the run live (pair with `--headed`) or replay it. Off by default; normal runs unaffected. |
| `CI` | Turns on retries (2), 2 workers, the `github` reporter, and `forbidOnly`. |

---

## Layer 1 — Unit / component tests (Vitest + jsdom)

- **Config:** `packages/webapp/vitest.config.ts` — `environment: 'jsdom'`, `globals: true`,
  `include: src/**/*.{test,spec}.{ts,tsx}`, path aliases (`@` → `src`, `@besser/wme` →
  the editor package source, `shared` → the shared package).
- **Setup:** `packages/webapp/src/test/setup.ts` — loads `@testing-library/jest-dom`
  and initialises i18next to English so `t()` returns real strings, not raw keys.
- **Convention:** tests are co-located next to the code they cover, in `__tests__/`
  folders (a couple sit directly beside the source file).
- **Scale:** **39 files, ~440 test cases.**

### By area

**Assistant — messaging, streaming & safety** (`src/main/features/assistant/…`)

| File | ~cases | Covers |
|---|---|---|
| `AssistantClient.injection.test.ts` | 6 | Prompt-injection guard — side-effect actions (`modify_model`, `trigger_smart_generator`, `inject_complete_system`) scraped from prose are rejected; only whole/structured replies act. |
| `AssistantClient.loading.test.ts` | 1 | Typing/loading indicator stays on across `progress` frames, clears only on the terminal reply (regression). |
| `AssistantClient.whitelist.test.ts` | 3 | `KNOWN_ACTIONS` whitelist includes `trigger_smart_generator` (source-text scan — see fragility note). |
| `suggestedActionRouting.test.ts` | 8 | `shouldOpenGuiTab` routes GUI chips to the GUI tab, never hijacks "Generate web app". |
| `useStreamingResponse.progress.test.ts` | 5 | `progressSteps` accumulation — order, dedupe, cap at 4, clear on completion. |
| `useAssistantLogic.smartgenKinds.test.ts` | 3 | `primaryKindOverride` whitelist forwards only `bpmn`/`nn`; agent's `skipDeterministicGenerator` not trusted (source-text scan). |
| `useAssistantLogic.voice.test.tsx` | 6 | `sendVoiceMessage` optimistic "Transcribing…" bubble, replace-in-place, error/timeout cleanup. |
| `buildIssueReport.test.ts` | 6 | Issue-report capture, secret redaction, Markdown transcript, filesystem-safe filename. |

**Assistant — diagram converters & modifiers** (`src/main/features/assistant/services/…`)

| File | ~cases | Covers |
|---|---|---|
| `modifiers.test.ts` | 22 | `applyModification` for Class / State-machine / Object / Agent diagrams (add class/attr/method, states/transitions, objects, agent intents/RAG). |
| `bpmn-assistant.test.ts` | 19 | `BPMNDiagramConverter` + `BPMNDiagramModifier` (nodes/flows/pools/lanes, message-flow inference, `add_flow`/`add_event`/`modify_node`). |
| `userDiagram.test.ts` | 9 | `UserDiagramConverter` + `UserDiagramModifier` via the assistant path (objects, links, icon children, className-referenced links). |

**Smart generation** (`src/main/features/smart-generation/…`)

| File | ~cases | Covers |
|---|---|---|
| `useSmartGenTrigger.test.tsx` | 25 | The trigger hook end-to-end (mocked SSE): happy stream→done, BYOK-missing dialog, free-tier default, override rules, single-run guard, cost meter, abort. |
| `SmartGenByokDialog.test.tsx` | 29 | The smart-gen BYOK dialog — visibility, key→sessionStorage, provider/model presets, budget controls, Save-&-run, keyless free tier. |
| `smartGeneratorSlice.test.ts` | 18 | Redux slice/thunks — dialog state, run lifecycle, global run-slot guard, atomic `consumePendingTrigger`/`tryClaimRunSlot`. |
| `runModeDecision.test.ts` | 12 | `isValidRunId` (32-hex) + `decideRunMode` modify-vs-fresh heuristic. |
| `smartGenConfig.test.ts` | 6 | `getSmartGenConfig` payload normalization, promise cache, fallback-on-failure. |
| `smartGenerationSseClient.test.ts` | 2 | `startSmartGenRun` snake_case body serialization (skip flag omitted unless approved). |

**BYOK dialog (shared)** (`src/main/shared/components/byok/`)

| File | ~cases | Covers |
|---|---|---|
| `LlmKeyDialog.test.tsx` | 5 | The unified `besser_llm_*` key dialog — sessionStorage writes, `setUserApiKey`, Local/PIA providers, key-prefix mismatch refusal. |

**Storage** (`src/main/shared/services/storage/`)

| File | ~cases | Covers |
|---|---|---|
| `ProjectStorageRepository.test.ts` | 22 | Save/load round-trip, latest pointer, project & diagram CRUD, `switchDiagramType`, change listeners. |
| `agent-base-model-normalization.test.ts` | 9 | `normalizeAgentModel` flat→nested upgrade (idempotent, non-mutating) + normalize-on-persist/migrate. |

**Project model, export & settings** (`src/main/shared/types`, `shared/utils`, `features/project`)

| File | ~cases | Covers |
|---|---|---|
| `project.test.ts` | 19 | Perspective defaults/visibility, `createDefaultProject`, v3→v4 migration, hidden-referenced-perspective detection. |
| `projectExportUtils.test.ts` | 22 | `diagramHasContent`, `buildExportableProjectPayload`, `buildProjectExportEnvelope` (pinned `2.0.0` + ISO timestamp), export→import round-trip. |
| `ProjectSettingsPanel.test.tsx` | 14 | The settings panel — loading/error/empty states, cards, presets/toggles, last-enabled guard, name edit, Export. |

**Editors — UI components & helpers** (`src/main/features/editors/…`, `src/main/app/shell/…`)

| File | ~cases | Covers |
|---|---|---|
| `WorkspaceSidebar.test.tsx` | 17 | Sidebar nav buttons, expand/collapse labels, active highlight, click handlers, perspective hiding. |
| `DiagramTabs.test.tsx` | 17 | Tab render/active/switch, add/close gating (`MAX_DIAGRAMS_PER_TYPE`), Object/GUI reference section. |
| `HiddenPerspectivesBanner.test.tsx` | 5 | Enable-button per hidden referenced perspective; dispatches the enable thunk. |
| `diagram-helpers.test.ts` | 5 | `getAgentOptions()` — agent-diagram discovery, filters untitled. |
| `multiplicity.test.ts` | 28 | UML↔ER cardinality parsing / conversion / round-trip (`@besser/wme`). |
| `attribute-display.test.ts` | 1 | `UMLUserModelAttribute` renders the criterion verbatim, preserved across serialize→deserialize. |
| `serialization.test.ts` | 10 | User-profile-form `buildUserDiagramModel`/`parseUserDiagramModel` round-trip + metamodel-tree derivation. |

**Import — BPMN** (`src/main/features/import/`)

| File | ~cases | Covers |
|---|---|---|
| `bpmn-xml-roundtrip.test.ts` | 5 | `apollonBpmnToXml` ↔ `bpmnXmlToApollon` full round-trip (DI bounds, waypoints, default-flow flag). |
| `bpmn-flow-validator.test.ts` | 11 | Legal flow-type pairs, default-flow eligibility, missing endpoints. |

**GUI generation helpers** (`src/main/shared/utils/…`)

| File | ~cases | Covers |
|---|---|---|
| `buildWebAppVersions.test.ts` | 14 | `slugify` / variant-profile collection / per-profile GUI-model build, slug collisions, no mutation. |
| `markTextEditable.test.ts` | 7 | Coerces bare GrapesJS text tags to editable nodes; leaves containers/links/UML models alone. |

**Shared plumbing, chatbot-kit UI & i18n**

| File | ~cases | Covers |
|---|---|---|
| `sseClient.test.ts` | 14 | Generic `streamSse` client — frame parsing (split/CRLF/heartbeat/multiline), abort, `SseHttpError`. |
| `chat-message.smartgen.test.tsx` | 12 | `SmartGenCard` — runtime meter (never shows `$`), Stop/cancel, Download states. |
| `use-auto-scroll.test.ts` | 5 | `useAutoScroll` — disable on scroll-up, re-enable at bottom, `scrollToBottom`. |
| `message-input.voice.test.tsx` | 3 | `MessageInput` mic button renders for widget & drawer prop sets when `onVoiceSend` is set. |
| `locale-parity.test.ts` | 12 | i18n parity — supported-codes match shipped locales, each non-en locale is a subset of English (no stale keys). |

### Known caveat: the ~32 jsdom "storage undefined" failures

There is a **known, pre-existing set of ~32 failing Vitest cases** (a deferred
follow-up, **not** a regression). They fail because `src/test/setup.ts` provides no
`localStorage`/`sessionStorage` shim, so tests that exercise real browser storage
hit "storage undefined" under the current jsdom configuration. The likely-affected
files are the ones that touch real storage:

- `ProjectStorageRepository.test.ts`, `diagram-helpers.test.ts`,
  `agent-base-model-normalization.test.ts` (its storage sub-block only) — **localStorage**;
- `SmartGenByokDialog.test.tsx`, `useSmartGenTrigger.test.tsx`, `LlmKeyDialog.test.tsx` — **sessionStorage**.

These are **"should-be-fixed", not dead weight** — they cover real, important code
(project persistence, BYOK key storage, the trigger flow). The fix is a test-harness
change (add a storage polyfill / guard in `setup.ts`, or opt those suites into a
jsdom storage env), **not** deleting the tests. None of them test a removed feature.
`ProjectSettingsPanel.test.tsx` sidesteps the issue by mocking `ProjectStorageRepository`.

---

## Layer 2 — End-to-end tests (Playwright / Chromium)

- **Config:** `packages/webapp/playwright.config.ts` — `testDir: ./tests/e2e`,
  `testMatch: **/*.spec.ts`, chromium-only, screenshots on failure, trace on first
  retry, auto-started Vite web server (skipped when `LIVE_E2E_BASE_URL` is set).
- **Scale:** **11 specs, ~53 tests** (one is live-gated and skipped by default).

Two flavours:

- **Mocked** — the spec stubs the backend with `page.route(...)` /
  `page.routeWebSocket(...)`, so it is deterministic and CI-safe. Nothing hits a real
  server or LLM.
- **Live** — the spec runs against the **real deployed stack** (real agent, real
  backend, real free-tier GPU). Slow and non-deterministic; gated behind an env flag.

The seven UI specs below run against the **local** Vite dev server with **no network
stubs** — they seed only the `besser_analytics_consent` localStorage key and assert
client-side behaviour (localStorage persistence, routing, menus, theme), so they
don't need the backend for their assertions.

| Spec | ~tests | Kind | Scenario |
|---|---|---|---|
| `smoke.spec.ts` | 5 | Local · real UI | App boots; Project Hub appears; create a blank project; sidebar renders; switch diagram type; header logo/File/Generate present. |
| `project.spec.ts` | 9 | Local · real UI | Project lifecycle — create with metadata, localStorage persistence across reload, reopen hub, list/switch/rename projects, import entry, back button. |
| `navigation.spec.ts` | 7 | Local · real UI | Sidebar diagram-type icons load each editor, Settings nav, collapse/expand, File/Generate/Deploy/Help dropdowns, chevrons. |
| `class-diagram.spec.ts` | 5 | Local · real UI | Class Diagram editor — canvas renders, create a class by double-click, Generate menu shows generator categories (Web/Database/OOP/Schema), identity panel shows project name. |
| `settings.spec.ts` | 11 | Local · real UI | Project Settings — layout, edit name/description, toggle "Show Instanced Objects" / "Show Association Names", Export present, diagram-tab visibility rules. |
| `er-notation.spec.ts` | 5 | Local · real UI | Class-diagram UML↔ER notation toggle, persistence to `besser-standalone-settings`, survives reload, ER editor renders (#508). |
| `theme.spec.ts` | 6 | Local · real UI | Dark/light toggle — `dark` class + `data-theme` on `<html>`, add/remove, persistence across reload, aria-label updates. |
| `github-deploy.spec.ts` | 1 | **Mocked** | Deploy contract — mocks GitHub auth + `deploy-webapp`, drives Deploy → Publish to Render, asserts the POST body carries the V2 `projectExport` envelope (`2.0.0`, ISO `exportedAt`, non-empty `diagrams`). |
| `smart-gen-free-tier.spec.ts` | 1 | **Mocked** | Keyless free tier — mocks the assistant WS (`trigger_smart_generator`), `/smart-gen/config` (advertise free), and the `/smart-generate` SSE; asserts an unauthorised trigger runs on `provider:'free'` with **no** `api_key`/`base_url`, **no** BYOK popup, reaches completion. |
| `smart-gen-full-flow.spec.ts` | 1 | **Mocked** | Full scripted conversation (no AI) — request → class **model** rendered on canvas → GUI-choice → Auto-generate builds the GUI → **the PAUSE** ("generate the web app?" instead of auto-running) → user asks → free-tier generation runs and completes. |
| `smart-gen-vibe-live.spec.ts` | 1 · gated | **Live** | The real "describe an app → get an app, no API key" path against the deployed stack — agent models a class diagram, spec-driven-generate on the free tier, asserts it finishes. Gated by `RUN_LIVE_E2E=1`; ~5–9 min, non-deterministic. |
