# BESSER Web Modeling Editor

BESSER Web Modeling Editor (WME) is the web-based diagram editor for the BESSER low-code platform. It lets you create
and edit B-UML diagrams, describe what you want in plain language and have an AI assistant build it on the canvas, and
run BESSER generators to turn a model into working code.

Projects can hold diagrams of nine types: `ClassDiagram`, `ObjectDiagram`, `StateMachineDiagram`, `AgentDiagram`,
`UserDiagram` (user profiles), `GUINoCodeDiagram`, `QuantumCircuitDiagram`, `NNDiagram` and `BPMN` — up to five tabs
per type (`packages/webapp/src/main/shared/types/project.ts`).

You can use this editor:
- As an online web application: now freely available at [BESSER WME Online](https://editor.besser-pearl.org).
- Locally or self-hosted: clone this repository (or use it as a submodule in the main BESSER repo) and follow the build
  instructions below.

## Repository layout

This repository is a monorepo:

- `packages/editor`: core diagramming engine, published as the [@besser/wme](https://www.npmjs.com/package/@besser/wme)
  npm package. The webapp resolves it through a path alias to local source, in dev and in production builds alike.
- `packages/webapp`: React web application (deployed at [editor.besser-pearl.org](https://editor.besser-pearl.org)). Uses Vite, Radix UI + Tailwind, and Vitest + Playwright.
- `packages/server`: Node/Express server that serves the built webapp plus two small endpoints
  (`/api/uml-agent/rate-limit/check`, `/api/svg`).
- `packages/i18n`: translation bundles (`en`, `lb`, `de`, `fr`, `es`, `ca`), one `webapp.json` and one `editor.json`
  per locale. Not an npm workspace — the packages import it by relative path.

The three npm workspaces are `packages/server`, `packages/webapp` and `packages/editor`.

## Main Features

### No account required

Users can access all features without creating an account.
All you have to do is open the application and start drawing.

### Easy to use editor

The user interface of BESSER WME is simple to use.
It works just like any other office and drawing tool that most users are familiar with.

- Pick the diagram type from the left sidebar. This selection determines the availability of elements that the user can
  use while drawing their diagram, making it easier for users who are newly introduced to modeling. Project Settings >
  Modeling Perspectives hides the types you do not need.
- Adding the element is as easy as dragging it from the elements menu and dropping it to the canvas. So is drawing the
  connection between them; simply drag and connect two or multiple elements.
- The layout of the connection is drawn automatically by the editor. If you want to manually lay it out, use the
  existing waypoint features.
- Edit or style the text or change the colors of any elements by double-clicking on them. An easy-to-use menu will allow
  you to do so.
- Use keyboard shortcuts to copy, paste, delete and move the elements throughout the canvas.
- Change the theme of the editor by clicking on the dark/light mode switch.

### Import and export your diagrams

Users can easily import existing BESSER WME diagrams to any editor that uses the BESSER WME library and continue
editing.

Exporting the diagrams is as easy as importing them.
Click on `File > Export Project` and pick what to export.

- Whole project: `JSON` (the format the import flow reads back) or `B-UML` (a single `.py` file).
- Current diagram: `SVG`, `PNG (White Background)`, `PNG (Transparent Background)`, `JSON`, or `B-UML`.

Single diagrams can also be imported into an open project from `.json`, `.py`, `.bpmn` and `.xml`;
whole projects from `.json` and `.py`. Two AI-assisted importers turn a screenshot
(`.png`/`.jpg`) or a knowledge graph (`.json`/`.ttl`/`.rdf`) into a class diagram.

### AI assistant and generation

The editor ships with a **Modeling Assistant**. You describe what you want in plain language and it builds or edits the
diagrams on the canvas. It is reachable as a floating chat bubble (bottom right) and as a workspace drawer that slides
up over the canvas; both share one conversation. Loading the editor with `?agentic` (or `?mode=agent`) opens the drawer
on start.

- The assistant talks over a **WebSocket** to the separate
  [modeling agent](https://github.com/BESSER-PEARL/modeling-agent) service. The client is
  `packages/webapp/src/main/features/assistant/services/AssistantClient.ts`; the URL it is constructed with comes from
  `UML_BOT_WS_URL` (`shared/constants/constant.ts`, wired in `features/assistant/hooks/useAssistantLogic.ts`) and
  defaults to `ws://localhost:8765` in development.
- The agent replies with structured actions the editor applies. The whitelist is `KNOWN_ACTIONS` in
  `AssistantClient.ts`: `assistant_message`, `inject_element`, `inject_complete_system`, `modify_model`,
  `switch_diagram`, `create_diagram_tab`, `trigger_generator`, `trigger_smart_generator`, `trigger_github_import`,
  `trigger_export`, `trigger_deploy`, `auto_generate_gui`, `agent_error`, `progress`, `stream_start`, `stream_chunk`,
  `stream_done`.
- Actions with real side effects are honoured **only** when they arrive as the whole structured reply, never when
  scraped out of prose, so a prompt-injected JSON blob inside an ordinary message cannot mutate your model or start a
  paid run (`SIDE_EFFECT_ACTIONS` in the same file).
- It can create and edit eight of the nine diagram types — everything except `NNDiagram` (see
  `features/assistant/services/converters/index.ts`). Voice input and file attachments (10 MB each) are supported.
- **Spec-Driven Agent** — turns a project into a whole application. It runs over HTTP + SSE against the BESSER
  backend's `/spec-driven/*` endpoints, not over the assistant socket. See
  `packages/webapp/src/main/features/spec-driven/`. Runs are gated: an explicit user request, one run at a time, a
  manual download step, and a server-enforced cost/runtime budget.
- **Bring your own key (BYOK).** One shared dialog
  (`packages/webapp/src/main/shared/components/byok/LlmKeyDialog.tsx`, reachable from the assistant bubble, the
  assistant drawer and Project Settings) collects a single key used by both the assistant and the Spec-Driven Agent.
  It is kept in `sessionStorage` for the tab's lifetime only — never in `localStorage`, never in Redux. The key is sent
  to the modeling agent as a session variable and to the BESSER backend in the spec-driven request body; the browser
  never calls the model provider directly. Providers: Anthropic, OpenAI, Mistral, plus any OpenAI-compatible local
  endpoint and the LIST PIA gateway.
- **Keyless free tier.** When the backend advertises one, the Spec-Driven Agent runs on a server-hosted open-weight
  model with no API key — the first keyless run silently opts in. The free tier applies to the generator only; the
  assistant without a key runs on the service's own credentials under per-tab rate limits.

### Create diagram from template

Users can also create a diagram from a template if they do not want to draw a diagram from scratch.
Click `File > Load Template` and pick one — class-diagram patterns, agents, state machines, BPMN processes, neural
networks, quantum circuits, or a complete example project.

## Under the Hood: Diagram Engine as an npm Package

The core diagramming engine lives in `packages/editor` and is published as [@besser/wme](https://www.npmjs.com/package/@besser/wme).
The web application (`packages/webapp`) and standalone server (`packages/server`) consume this package.

This separation allows the application to focus on delivering additional capabilities such as:

- Projects, diagram tabs and templates
- The AI assistant and the Spec-Driven Agent
- Export/import/generation to multiple formats, and GitHub integration
- Hosting via application server or Docker

Meanwhile, all diagram rendering and editing logic is delegated to the core engine, ensuring consistency and reusability
across multiple front-ends or integrations.

## Documentation

The full user and contributor guide is built with Sphinx from `docs/source`:

```
pip install -r docs/requirements.txt
cd docs && make html          # Windows: make.bat html
```

Start with `docs/source/user-guide/` for the editor, the AI assistant, the Spec-Driven Agent and API keys, and
`docs/source/contributing/` for the codebase tour.

## Contributing

We encourage contributions from the community and any comment is welcome!

If you are interested in contributing to this project, please read the [CONTRIBUTING.md](CONTRIBUTING.md) file.

## Code of Conduct

At BESSER, our commitment is centered on establishing and maintaining development environments that are welcoming,
inclusive, safe and free from all forms of harassment. All participants are expected to voluntarily respect and support
our [Code of Conduct](CODE_OF_CONDUCT.md).

## Governance

The development of this project follows the governance rules described in the [GOVERNANCE.md](GOVERNANCE.md) document.

## Contact

You can reach us at: [info@besser-pearl.org](mailto:info@besser-pearl.org)

## Local development

Prerequisites: Node.js 20+ and npm.

### Clone the repository

```
git clone https://github.com/BESSER-PEARL/BESSER-Web-Modeling-Editor.git
cd BESSER-Web-Modeling-Editor
```

### Install dependencies

```
npm install
```

### Start the web application

```
npm run dev
```

The dev server (Vite) runs on http://localhost:8080. In development mode the backend URL is hardcoded to
http://localhost:9000/besser_api and the modeling agent to ws://localhost:8765 — see
`packages/webapp/src/main/shared/constants/constant.ts`.

### Run the standalone server

The standalone server serves the built webapp bundle.

```
npm run build:webapp
npm run start:server
```

### Build for production

```
npm run build          # builds the webapp (Vite) and the server (Webpack) into build/
```

The Docker image builds the same way and serves `build/server/bundle.js` with Node on port 8080.

### Configuration

There is no `.env` file in this repository. The webapp's configuration is injected **at build time** by Vite's
`define` (see `packages/webapp/vite.config.ts`), from either `process.env.<NAME>` or a `VITE_<NAME>` fallback. The
Dockerfile exposes the same names as build args.

| Variable | Purpose |
| --- | --- |
| `DEPLOYMENT_URL` | Public origin of the deployment; also the fallback for the modeling-agent WebSocket URL (`ws`/`wss` + host) |
| `BACKEND_URL` | BESSER backend base URL (production only — development is hardcoded) |
| `UML_BOT_WS_URL` | WebSocket endpoint of the modeling agent |
| `APPLICATION_SERVER_VERSION` | Defined and exported, but currently read by no component |
| `SENTRY_DSN` | Optional error reporting |
| `POSTHOG_KEY`, `POSTHOG_HOST` | Optional product analytics |

`packages/server` reads only `DEPLOYMENT_URL` and `SENTRY_DSN` at runtime; its port is hardcoded to 8080.

> **`GITHUB_CLIENT_ID` is a dead build arg.** The Dockerfile declares it, but it is not in the Vite `define` block and
> nothing in `packages/webapp` or `packages/server` reads it, so it never reaches the browser bundle. GitHub sign-in
> works because the **BESSER Python backend** owns the OAuth app: the webapp redirects to
> `<BACKEND_URL>/github/auth/login`, the backend does the code-for-token exchange with its own `GITHUB_CLIENT_ID` /
> `GITHUB_CLIENT_SECRET` / `GITHUB_REDIRECT_URI`, and redirects back to `<DEPLOYMENT_URL>?github_session=…&username=…`.
> The access token never reaches the browser — only an opaque session id, kept in `sessionStorage`.

### Tests, linting and formatting

There is **no `test` script at the monorepo root** — tests run from `packages/webapp`:

```
npm run test          --workspace=webapp   # Vitest (jsdom)
npm run test:watch    --workspace=webapp
npm run test:coverage --workspace=webapp
npm run test:e2e      --workspace=webapp   # Playwright
```

From the repository root:

```
npm run lint             # ESLint across the webapp and server packages
npm run prettier:check   # or prettier:write
npm run i18n:check       # translation key checks
npm run i18n:validate
```

### Working from the main BESSER repo

If you are working from the main BESSER repository, initialize the submodule and run the same commands from
`besser/utilities/web_modeling_editor/frontend`:

```
git submodule update --init --recursive
cd besser/utilities/web_modeling_editor/frontend
npm install
npm run dev
```

## License

This project is licensed under the [MIT](https://mit-license.org/) license.
