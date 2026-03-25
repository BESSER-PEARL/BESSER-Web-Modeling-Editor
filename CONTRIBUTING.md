# Contributing to BESSER Web Modeling Editor

Thank you for your interest in contributing to the BESSER Web Modeling Editor (WME)!

This repository hosts the WME frontend (webapp + server) and the core diagramming engine (`packages/editor`).
The BESSER backend (metamodels, generators, editor backend) lives in
https://github.com/BESSER-PEARL/BESSER.

The WME repository is also vendored into the BESSER backend repo as a git submodule at
`besser/utilities/web_modeling_editor/frontend`.

## Asking questions and reporting issues

If you have a question or found a bug, please open an issue at:
https://github.com/BESSER-PEARL/BESSER-WEB-MODELING-EDITOR/issues

Before filing a new issue, search the open issues to avoid duplicates.

## Local setup

Prerequisites: Node.js 20+ and npm.

### Clone the repository

```bash
git clone https://github.com/BESSER-PEARL/BESSER-WEB-MODELING-EDITOR.git
cd BESSER-WEB-MODELING-EDITOR
```

### Install dependencies

```bash
npm install
```

### Start the web application

```bash
npm run dev
```

The dev server runs on http://localhost:8080 and, in development mode, expects the BESSER backend at
http://localhost:9000/besser_api (see `packages/webapp2/src/main/constants/constant.ts`).

### Useful commands

- `npm run dev` - start the webapp2 React app in development mode (Vite).
- `npm run build:webapp2` - build the webapp2 bundle.
- `npm run start:server` - serve the built webapp with the standalone server.
- `npm run lint` - run lint checks across workspaces.
- `npm run test` - run unit tests with Vitest.
- `npm run test:e2e` - run end-to-end tests with Playwright.

## Pull requests

1. Fork the repository and create a feature branch from `main`.
2. Keep commits focused and update documentation when behavior changes.
3. Run the relevant checks (`npm run lint`, `npm run build:webapp2`).
4. Open a pull request and describe the change clearly.

## Changes that also impact the BESSER backend

If your change touches both the WME frontend and the BESSER backend (for example, a new DSL with graphical notation):

1. Implement and commit the frontend changes in this repository.
2. Implement the backend changes in the BESSER repository.
3. After the WME change is ready, update the git submodule pointer in the BESSER repo to the new WME commit.
4. Link the two pull requests so reviewers can merge them in the right order.

## Code of Conduct and Governance

All contributions are handled according to our [Code of Conduct](CODE_OF_CONDUCT.md) and
[GOVERNANCE.md](GOVERNANCE.md).

Thank you for helping make BESSER better!
