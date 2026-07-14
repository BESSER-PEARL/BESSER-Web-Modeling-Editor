# WME test catalogue

A single place to read **what is tested** for the Web Modeling Editor UI and the
natural-language generation flows — the "where can I read the description of
these tests?" index.

There are three test surfaces:

| Surface | Tech | Location | What it proves |
|---|---|---|---|
| **UI end-to-end** | Playwright (Chromium) | `packages/webapp/tests/e2e/*.spec.ts` | Real browser drives the app shell, navigation, project lifecycle, settings, theme, deploy contract. |
| **Component / logic** | Vitest (jsdom) | `packages/webapp/src/**/__tests__/` | Assistant routing, smart-gen SSE/Redux/dialogs, BYOK dialog — in isolation (mocked). |
| **NL-generation matrix** | Python WS probe | `modeling-agent/tests/live/test_nl_generation_scenarios.py` | Live agent routes real NL phrasings ("generate a database", …) to the right generator. |

---

## 1. Playwright E2E specs (`tests/e2e/`)

Run from the **webapp** workspace:

```bash
npm run test:e2e --workspace=webapp        # headless
npm run test:e2e:ui --workspace=webapp     # interactive
```

Auto-starts Vite on :8080 (`playwright.config.ts`); several specs also expect the
backend on :9000. Each spec's top-of-file JSDoc comment is the authoritative
description; summarised here:

| Spec | Scenario |
|---|---|
| `smoke.spec.ts` | App boots; Project Hub appears; create a blank project; shell + sidebar render; switch diagram type; header menus present. |
| `project.spec.ts` | Project lifecycle: create with metadata, localStorage persistence across reload, reopen hub, list/switch projects, rename, import entry, hub back-button. |
| `navigation.spec.ts` | Sidebar diagram-type icons load each editor; Settings nav; sidebar collapse/expand; File/Generate/Deploy/Help dropdowns; theme toggle. |
| `class-diagram.spec.ts` | Class Diagram editor: canvas renders, create class via double-click, **Generate menu shows generator categories** (Web/Database/OOP/Schema), identity panel. |
| `settings.spec.ts` | Project Settings: layout, edit name/description, toggle "Show Instanced Objects" / "Show Association Names", Export present, diagram-tab visibility. |
| `er-notation.spec.ts` | Class-diagram notation UML↔ER toggle, persistence to `besser-standalone-settings`, survives reload, ER rendering (#508). |
| `theme.spec.ts` | Dark/light toggle: `dark` class + `data-theme` on `<html>`, persistence, aria-label. |
| `github-deploy.spec.ts` | Deploy contract: mocks GitHub auth + `deploy-webapp`, asserts the POST body carries the V2 `projectExport` envelope (v `2.0.0`, ISO `exportedAt`, non-empty `diagrams`). |

**Coverage gap (important):** No Playwright spec drives the **AI assistant** or a
**natural-language "generate X"** flow. The only generation-related check just
opens the Generate menu and looks for category labels — it does not run a
generator or exercise the assistant. Those flows are covered by the NL-generation
matrix (§3) and Vitest logic tests (§2) instead.

## 2. Vitest logic tests (`src/**/__tests__/`)

```bash
npm run test --workspace=webapp
```

Assistant routing (`features/assistant/.../suggestedActionRouting.test.ts`,
`AssistantClient.*.test.ts`), smart-generation (`features/smart-generation/**`:
trigger, SSE client, Redux slice, run-mode, BYOK dialog), and chatbot-kit UI.
These mock React/Redux/SSE — they don't drive a real browser or backend.

## 3. NL-generation scenario matrix (agent-side)

Drives the **live** agent WebSocket with the exact phrasings users type and
asserts each routes to an acceptable generator (and never a forbidden one — e.g.
"generate a database" must never hit `django`). This is the regression net for
the class of bug where a database request was answered with Django questions.

```bash
# standalone (prints a table, exits non-zero on failure — deploy-gate friendly)
cd modeling-agent
AGENT_WS_URL=wss://experimental.besser-pearl.org/agent REPEATS=3 \
  python tests/live/test_nl_generation_scenarios.py

# or via pytest (skipped unless explicitly enabled)
RUN_LIVE_AGENT_TESTS=1 python -m pytest tests/live/test_nl_generation_scenarios.py
```

Scenarios (see the file for the authoritative list + accept/forbid sets): only a
database, the database, SQL schema, SQLAlchemy models, backend, database+backend,
full web app, django, pydantic. The classifier is non-deterministic, so each is
probed `REPEATS` times against a pass threshold; any hit on a forbidden generator
fails it outright. Add new rows to `SCENARIOS`.

Deterministic companion (no live agent, runs in normal CI):
`modeling-agent/tests/test_generation_handler.py` pins the handler/dispatch logic
— e.g. the "pivot out of a stuck Django config flow when the user asks for a
database instead" regression.

---

## What runs automatically today

- **CI** (`.github/workflows/ci.yml`): backend `pytest` + `ruff` only.
- **Deploy** (`deploy-wme.yml`): builds/pushes Docker images + SSH `docker compose`.
- **Neither runs Playwright or the NL-generation matrix.** They are manual/local
  today. To gate a deploy on the NL matrix, run §3 as a step after deploy and
  fail the pipeline on a non-zero exit.
