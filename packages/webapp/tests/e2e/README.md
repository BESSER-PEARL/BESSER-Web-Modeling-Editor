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
| **Free-tier generation E2E** | Python (live SSE) | `BESSER/tests/live/test_vibe_free_e2e.py` | Real keyless free-tier vibe generation against the deployed stack produces the expected artifact (a backend app; Rust classes). Asserts output is produced — **not** that it boots. |

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
| `smart-gen-free-tier.spec.ts` | **Assistant → generate, end to end (mocked).** Mocks the assistant WebSocket (injects `trigger_smart_generator`), `/smart-gen/config` (advertise free tier), and the `/smart-generate` SSE (canned start/phase/done). Opens a project, sends a prompt, clicks **"Use the free model"**, and asserts the run POSTs `provider:'free'` with **no** `api_key`/`base_url`, reaches completion, and never shows the "no API key — did not run" message. Deterministic; safe for CI. |
| `smart-gen-vibe-live.spec.ts` | **FULL vibe pipeline, no mocks (gated live smoke).** Fresh browser → create a project → describe an app in plain words so the agent **models** a class diagram → **spec-driven generate** a full app on the **keyless free tier** → asserts it finishes. Real agent + backend + free GPU, so SLOW (~5 min) and non-deterministic; gated behind `RUN_LIVE_E2E=1`, points at the deployed stack. `RUN_LIVE_E2E=1 npx playwright test smart-gen-vibe-live`. |

**What `smart-gen-free-tier.spec.ts` does and does NOT catch:** it guards the
happy-path free run and the wire contract (free UI appears, keyless payload,
run starts, download offered). It does **not** reproduce the production-only
timing race that once made "Use the free model" close the dialog and do nothing
(Radix `onOpenChange` → cancel handler clearing the approved trigger before the
resume effect ran). That race does not manifest in Vite dev (the effect wins) or
jsdom (Radix doesn't fire `onOpenChange` on a controlled close) — only a
production build reproduces it, so it was caught by a live-browser click and is
now held by the `startingRunRef` guard (do not remove it). To auto-guard the race
itself, a future job would run Playwright against a **production build** (`vite
build` + preview) rather than the dev server.

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

## 4. Free-tier generation E2E (backend live)

Drives the **whole vibe pipeline** over the deployed backend SSE endpoint
(`POST /besser_api/smart-generate`, `provider="free"`) with a golden class model,
and asserts the real keyless free tier (Cloudflare-tunnelled qwen3-coder)
completes and produces the expected artifact:

- **full app** — model → a FastAPI backend (`main_api.py`, `pydantic_classes.py`, …);
- **rust** — model → a `.rs` file with structs.

```bash
# pytest (skipped unless enabled) — SLOW (~1-3 min each, shared GPU)
RUN_LIVE_FREE_E2E=1 python -m pytest BESSER/tests/live/test_vibe_free_e2e.py -s

# standalone demo runner (prints PASS/FAIL summary, non-zero exit on failure)
python BESSER/tests/live/test_vibe_free_e2e.py
```

**Scope on purpose:** asserts *generation produced the right kind of output*, NOT
that the produced app *runs*. The boot/run fidelity check (does the generated
backend actually start?) is the deferred Phase-3 boot-check work — tracked
separately because free-model output often doesn't boot yet, and we don't want a
known-flaky fidelity gate blocking these plumbing checks.

---

## What runs automatically today

- **CI** (`.github/workflows/ci.yml`): backend `pytest` + `ruff` only.
- **Deploy** (`deploy-wme.yml`): builds/pushes Docker images + SSH `docker compose`.
- **Neither runs Playwright or the NL-generation matrix.** They are manual/local
  today. To gate a deploy on the NL matrix, run §3 as a step after deploy and
  fail the pipeline on a non-zero exit.
